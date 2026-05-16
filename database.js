const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Initialize tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS warnings (
    userId TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS bans (
    userId TEXT PRIMARY KEY,
    reason TEXT,
    bannedBy TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// Default config values
const defaultConfigs = {
  ticketCategory: '',
  ticketSupportRole: '',
  ticketEmbedColor: '#0099ff',
  ticketWelcomeMessage: 'Welcome to your ticket! Please wait for a staff member.',
  logChannel: '',
  ticketPanelChannel: ''
};

const insertConfig = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultConfigs)) {
  insertConfig.run(key, value);
}

module.exports = db;
