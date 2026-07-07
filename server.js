const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '15mb' }));

const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, 'server-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'menu-data.json');
const SEED_FILE = path.join(__dirname, 'server', 'data-seed.json');

if (!fs.existsSync(DATA_FILE)) {
  fs.copyFileSync(SEED_FILE, DATA_FILE);
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

let cache = readData();

app.get('/api/menu', (req, res) => {
  res.json(cache);
});

app.post('/api/menu', (req, res) => {
  const { dishes, cats } = req.body || {};
  if (!Array.isArray(dishes) || !Array.isArray(cats)) {
    return res.status(400).json({ error: 'dishes and cats must be arrays' });
  }
  cache = { dishes, cats, version: (cache.version || 0) + 1, updatedAt: Date.now() };
  writeData(cache);
  res.json({ ok: true, version: cache.version });
});

app.use(express.static(path.join(__dirname, 'www')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('server listening on', PORT, '- data dir:', DATA_DIR));
