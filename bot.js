const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Helper to get config
function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  return row ? row.value : null;
}

client.once('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// Event listener for config updates
client.on('updateTicketPanel', async (channelId) => {
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) return;

    const embedColor = getConfig('ticketEmbedColor') || '#0099ff';
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle('Support Tickets')
      .setDescription('Click the button below to open a support ticket.')
      .setFooter({ text: 'Ticket System' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Create Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );

    await channel.send({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Failed to send ticket panel:', error);
  }
});

const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  if (inviteRegex.test(message.content)) {
    const member = message.member;
    // Bypass for admins/mods
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

    // Delete message
    try { await message.delete(); } catch(e) {}

    const userId = message.author.id;
    let warning = db.prepare('SELECT count FROM warnings WHERE userId = ?').get(userId);

    const logChannelId = getConfig('logChannel');
    const logChannel = logChannelId ? client.channels.cache.get(logChannelId) : null;

    if (!warning || warning.count === 0) {
      // First offense: Mute 60 seconds
      db.prepare('INSERT OR REPLACE INTO warnings (userId, count) VALUES (?, 1)').run(userId);
      
      try {
        await member.timeout(60 * 1000, 'Posting Discord Invites (1st offense)');
      } catch (err) {
        console.error('Missing permissions to timeout user.');
      }

      const warnEmbed = new EmbedBuilder()
        .setColor('#ffcc00')
        .setTitle('Warning: Unauthorized Invite Link')
        .setDescription('You have been muted for 60 seconds for posting an invite link. A second offense will result in a permanent ban.');
      
      try { await message.author.send({ embeds: [warnEmbed] }); } catch(e) {}

      db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run('INVITE_WARNING', `Warned ${message.author.tag} (${userId}) for invite link in ${message.channel.name}`);
      
      if (logChannel) {
        logChannel.send({ embeds: [new EmbedBuilder().setColor('Yellow').setTitle('User Warned').setDescription(`**User:** ${message.author.tag}\n**Action:** 60s Mute\n**Reason:** Posted an invite link`).setTimestamp()]});
      }

    } else {
      // Second offense: Permanent ban
      const reason = 'Posting Discord Invites (2nd offense)';
      db.prepare('INSERT INTO bans (userId, reason, bannedBy) VALUES (?, ?, ?)').run(userId, reason, client.user.id);
      db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run('INVITE_BAN', `Banned ${message.author.tag} (${userId}) for repeat invite link`);
      
      const banEmbed = new EmbedBuilder()
        .setColor('#ff0000')
        .setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
        .setTitle('You have been banned')
        .addFields(
          { name: 'Date', value: new Date().toLocaleDateString(), inline: true },
          { name: 'Expires', value: 'Never (Permanent)', inline: true },
          { name: 'Reason', value: reason },
          { name: 'Banned By', value: 'Automoderator' }
        )
        .setTimestamp();
        
      try { await message.author.send({ embeds: [banEmbed] }); } catch(e) {}
      
      try {
        await member.ban({ reason });
      } catch (err) {
        console.error('Missing permissions to ban user.');
      }

      if (logChannel) {
        logChannel.send({ embeds: [new EmbedBuilder().setColor('Red').setTitle('User Banned').setDescription(`**User:** ${message.author.tag}\n**Action:** Permanent Ban\n**Reason:** Posted an invite link (2nd offense)`).setTimestamp()]});
      }
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const ticketCategory = getConfig('ticketCategory');
    const ticketSupportRole = getConfig('ticketSupportRole');
    
    if (!ticketCategory) {
      return interaction.reply({ content: 'Ticket category not configured.', ephemeral: true });
    }

    try {
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: ticketCategory,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          // Add support role if configured
          ...(ticketSupportRole ? [{
            id: ticketSupportRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          }] : [])
        ],
      });

      const embedColor = getConfig('ticketEmbedColor') || '#0099ff';
      const welcomeMsg = getConfig('ticketWelcomeMessage') || 'Welcome to your ticket! Please wait for a staff member.';

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setDescription(welcomeMsg)
        .setTimestamp();

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ 
        content: `<@${interaction.user.id}>${ticketSupportRole ? ` <@&${ticketSupportRole}>` : ''}`,
        embeds: [embed],
        components: [closeRow] 
      });

      await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
      db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run('TICKET_CREATE', `Ticket created by ${interaction.user.tag}`);
    } catch (error) {
      console.error(error);
      interaction.reply({ content: 'Failed to create ticket. Please contact an admin.', ephemeral: true });
    }
  } else if (interaction.customId === 'close_ticket') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: 'You do not have permission to close tickets.', ephemeral: true });
    }
    await interaction.reply('Closing ticket in 5 seconds...');
    db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run('TICKET_CLOSE', `Ticket closed in ${interaction.channel.name} by ${interaction.user.tag}`);
    setTimeout(() => {
      interaction.channel.delete().catch(console.error);
    }, 5000);
  }
});

client.login(process.env.BOT_TOKEN).catch(err => console.error("Failed to login bot: Invalid token provided. Dashboard will still run."));

module.exports = client;
