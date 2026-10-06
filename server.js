const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '60mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

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
  const { dishes, cats, promos } = req.body || {};
  if (!Array.isArray(dishes) || !Array.isArray(cats)) {
    return res.status(400).json({ error: 'dishes and cats must be arrays' });
  }
  cache = { dishes, cats, promos: Array.isArray(promos) ? promos : [], version: (cache.version || 0) + 1, updatedAt: Date.now() };
  writeData(cache);
  res.json({ ok: true, version: cache.version });
});

// ── ORDERS (punched at the tablet, consumed by the analytics desktop app) ──
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

function readOrders() {
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}
function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders));
}

let orders = readOrders();
let nextOrderId = orders.reduce((m, o) => Math.max(m, o.id), 0) + 1;

app.post('/api/orders', (req, res) => {
  const { items, subtotal, service, total } = req.body || {};
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }
  for (const it of items) {
    if (typeof it.id === 'undefined' || typeof it.name !== 'string' || typeof it.qty !== 'number' || typeof it.price !== 'number') {
      return res.status(400).json({ error: 'each item needs id, name, qty, price' });
    }
  }
  const order = {
    id: nextOrderId++,
    items,
    subtotal: Number(subtotal) || items.reduce((s, i) => s + i.price * i.qty, 0),
    service: Number(service) || 0,
    total: Number(total) || 0,
    ts: Date.now(),
  };
  orders.push(order);
  writeOrders(orders);
  res.json({ ok: true, id: order.id });
});

app.get('/api/orders/recent', (req, res) => {
  const since = Number(req.query.since) || 0;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const result = orders.filter(o => o.ts > since).slice(-limit);
  res.json(result);
});

app.get('/api/orders/stats', (req, res) => {
  const from = Number(req.query.from) || 0;
  const to = Number(req.query.to) || Date.now();
  const inRange = orders.filter(o => o.ts >= from && o.ts <= to);

  const perDish = new Map();
  let revenue = 0;
  for (const o of inRange) {
    revenue += o.total;
    for (const it of o.items) {
      const key = it.id;
      const e = perDish.get(key) || { id: it.id, name: it.name, qty: 0, revenue: 0 };
      e.qty += it.qty;
      e.revenue += it.price * it.qty;
      perDish.set(key, e);
    }
  }
  const dishStats = [...perDish.values()].sort((a, b) => b.qty - a.qty);
  const soldIds = new Set(dishStats.map(d => d.id));
  const neverSold = (cache.dishes || [])
    .filter(d => !soldIds.has(d.id))
    .map(d => ({ id: d.id, name: d.names ? (d.names.ru || Object.values(d.names)[0]) : String(d.id) }));

  res.json({
    from, to,
    orderCount: inRange.length,
    revenue,
    topDishes: dishStats,
    neverSold,
  });
});

app.use(express.static(path.join(__dirname, 'www')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'www', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('server listening on', PORT, '- data dir:', DATA_DIR));
