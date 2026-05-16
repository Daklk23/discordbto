require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const bot = require('./bot');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Endpoints for Dashboard

// Get config
app.get('/api/config', (req, res) => {
  const configs = db.prepare('SELECT * FROM config').all();
  const configObj = {};
  for (const row of configs) {
    configObj[row.key] = row.value;
  }
  res.json(configObj);
});

// Update config
app.post('/api/config', (req, res) => {
  const updates = req.body;
  const stmt = db.prepare('UPDATE config SET value = ? WHERE key = ?');
  const updatePanelStmt = db.prepare("SELECT value FROM config WHERE key = 'ticketPanelChannel'");
  const oldPanelId = updatePanelStmt.get()?.value;

  db.transaction(() => {
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(value, key);
    }
  })();

  // Log action
  db.prepare('INSERT INTO logs (action, details) VALUES (?, ?)').run('UPDATE_CONFIG', JSON.stringify(updates));

  // If ticket panel channel changed, trigger bot to send panel
  if (updates.ticketPanelChannel && updates.ticketPanelChannel !== oldPanelId) {
    bot.emit('updateTicketPanel', updates.ticketPanelChannel);
  }

  res.json({ success: true });
});

// Get logs
app.get('/api/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM logs ORDER BY timestamp DESC LIMIT 100').all();
  res.json(logs);
});

// Get stats (for dashboard overview)
app.get('/api/stats', (req, res) => {
  const warningCount = db.prepare('SELECT COUNT(*) as count FROM warnings').get().count;
  const banCount = db.prepare('SELECT COUNT(*) as count FROM bans').get().count;
  res.json({ warningCount, banCount });
});

// Get bans and warnings
app.get('/api/infractions', (req, res) => {
  const warnings = db.prepare('SELECT * FROM warnings').all();
  const bans = db.prepare('SELECT * FROM bans ORDER BY timestamp DESC').all();
  res.json({ warnings, bans });
});

app.listen(port, () => {
  console.log(`Web dashboard running at http://localhost:${port}`);
});
