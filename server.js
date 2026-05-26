require('dotenv').config({
  path: `.env.${process.env.NODE_ENV || 'dev'}`
});

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'dev';

// Injecter NODE_ENV avant le middleware static (priorité sur public/env.js)
app.get('/env.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(`window.__ENV__ = { NODE_ENV: '${NODE_ENV}', PORT: '${PORT}' };`);
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — toutes les routes servent index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[node-tracker] Server running in ${NODE_ENV} mode on http://localhost:${PORT}`);
});
