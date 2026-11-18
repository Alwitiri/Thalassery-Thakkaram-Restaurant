const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const seed = require('./seed');

const PORT = process.env.PORT || 3000;
// On Render, point STORAGE_DIR at a persistent disk mount (e.g. /var/data) so content survives deploys.
const STORAGE_DIR = process.env.STORAGE_DIR || __dirname;
const DATA_DIR = path.join(STORAGE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(STORAGE_DIR, 'uploads');
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ---------------- storage ---------------- */
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw, { salt, hash }) {
  const h = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}

let db;
function load() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = seed();
  }
  if (!db.admin) {
    db.admin = { username: 'admin', ...hashPassword(DEFAULT_PASSWORD), mustChange: true };
  }
  save();
}
function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
load();

const newId = (p) => `${p}_${crypto.randomBytes(5).toString('hex')}`;
const sortByOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const str = (v, max = 2000) => (v == null ? '' : String(v).trim().slice(0, max));

/* ---------------- app ---------------- */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Render / reverse proxies: correct client IP and https protocol
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

/* ---------------- sessions ---------------- */
const sessions = new Map(); // token -> expiry
const SESSION_MS = 1000 * 60 * 60 * 12;
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function requireAdmin(req, res, next) {
  const t = getCookie(req, 'tt_session');
  const exp = t && sessions.get(t);
  if (!exp || exp < Date.now()) {
    if (t) sessions.delete(t);
    return res.status(401).json({ error: 'Not logged in' });
  }
  sessions.set(t, Date.now() + SESSION_MS);
  next();
}

// simple in-memory rate limiter for public POSTs and login
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.path + '|' + req.ip;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Too many requests, please try again later.' });
    arr.push(now);
    hits.set(key, arr);
    next();
  };
}

/* ---------------- public API ---------------- */
app.get('/api/public', (req, res) => {
  res.json({
    settings: db.settings,
    slides: [...db.slides].sort(sortByOrder),
    categories: [...db.categories].sort(sortByOrder),
    menu: db.menu.filter((m) => m.available).sort(sortByOrder),
    gallery: [...db.gallery].sort(sortByOrder),
    reviews: db.reviews.filter((r) => r.approved).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
});

app.post('/api/reviews', rateLimit(3, 60 * 60 * 1000), (req, res) => {
  const name = str(req.body.name, 60);
  const text = str(req.body.text, 600);
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 5));
  if (!name || text.length < 5) return res.status(400).json({ error: 'Please add your name and a short review.' });
  db.reviews.push({ id: newId('r'), name, text, rating, approved: false, createdAt: new Date().toISOString() });
  save();
  res.json({ ok: true, message: 'Thank you! Your review will appear after approval.' });
});

app.post('/api/reservations', rateLimit(5, 60 * 60 * 1000), (req, res) => {
  const b = req.body || {};
  const r = {
    id: newId('b'),
    type: b.type === 'order' ? 'order' : b.type === 'enquiry' ? 'enquiry' : 'table',
    name: str(b.name, 80),
    phone: str(b.phone, 30),
    date: str(b.date, 20),
    time: str(b.time, 20),
    guests: Math.max(0, Math.min(100, parseInt(b.guests, 10) || 0)),
    message: str(b.message, 1000),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  if (!r.name || !/^[+\d\s-]{7,}$/.test(r.phone)) return res.status(400).json({ error: 'Please enter your name and a valid phone number.' });
  db.reservations.push(r);
  save();
  res.json({ ok: true, message: r.type === 'table' ? 'Table request received! We will call you to confirm.' : 'Thanks! We will get back to you shortly.' });
});

app.get('/api/qr.svg', async (req, res) => {
  const url = `${req.protocol}://${req.get('host')}/#menu`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#13221a', light: '#ffffff' } });
  res.type('image/svg+xml').send(svg);
});

/* ---------------- admin auth ---------------- */
app.post('/api/admin/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const { username, password } = req.body || {};
  if (username !== db.admin.username || !password || !checkPassword(String(password), db.admin)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_MS);
  res.setHeader('Set-Cookie', `tt_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${req.secure ? '; Secure' : ''}`);
  res.json({ ok: true, mustChange: !!db.admin.mustChange });
});

app.post('/api/admin/logout', (req, res) => {
  const t = getCookie(req, 'tt_session');
  if (t) sessions.delete(t);
  res.setHeader('Set-Cookie', 'tt_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ username: db.admin.username, mustChange: !!db.admin.mustChange });
});

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { current, next: nextPw, username } = req.body || {};
  if (!current || !checkPassword(String(current), db.admin)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!nextPw || String(nextPw).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  db.admin = { username: str(username, 40) || db.admin.username, ...hashPassword(String(nextPw)), mustChange: false };
  save();
  res.json({ ok: true });
});

/* ---------------- admin data ---------------- */
app.get('/api/admin/data', requireAdmin, (req, res) => {
  const { admin, ...rest } = db;
  res.json(rest);
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  for (const key of Object.keys(db.settings)) {
    if (key in req.body) db.settings[key] = str(req.body[key], 4000);
  }
  save();
  res.json(db.settings);
});

// Generic CRUD for collections
const schemas = {
  menu: { prefix: 'm', fields: { name: 's', category: 's', price: 'n', description: 's', image: 's', veg: 'b', signature: 'b', available: 'b', order: 'n' }, required: ['name'] },
  categories: { prefix: 'c', fields: { name: 's', order: 'n' }, required: ['name'] },
  gallery: { prefix: 'g', fields: { title: 's', image: 's', order: 'n' }, required: ['image'] },
  slides: { prefix: 's', fields: { script: 's', title: 's', text: 's', image: 's', label: 's', order: 'n' }, required: ['title'] },
  reviews: { prefix: 'r', fields: { name: 's', rating: 'n', text: 's', approved: 'b' }, required: ['name'] },
  reservations: { prefix: 'b', fields: { status: 's', name: 's', phone: 's', date: 's', time: 's', guests: 'n', message: 's', type: 's' }, required: ['name'] },
};
function clean(schema, body, partial) {
  const out = {};
  for (const [k, t] of Object.entries(schema.fields)) {
    if (!(k in body)) continue;
    const v = body[k];
    out[k] = t === 'n' ? Number(v) || 0 : t === 'b' ? !!v : str(v, 2000);
  }
  if (!partial) {
    for (const [k, t] of Object.entries(schema.fields)) if (!(k in out)) out[k] = t === 'n' ? 0 : t === 'b' ? false : '';
    for (const r of schema.required) if (!out[r]) throw new Error(`"${r}" is required`);
  }
  return out;
}

for (const [name, schema] of Object.entries(schemas)) {
  const base = `/api/admin/${name}`;
  app.post(base, requireAdmin, (req, res) => {
    try {
      const item = { id: newId(schema.prefix), ...clean(schema, req.body || {}, false) };
      if (name === 'categories') item.id = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || item.id;
      if (db[name].some((x) => x.id === item.id)) item.id = newId(schema.prefix);
      if ('order' in schema.fields && !item.order) item.order = db[name].length + 1;
      if (name === 'reviews') item.createdAt = new Date().toISOString();
      db[name].push(item);
      save();
      res.json(item);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  app.put(`${base}/:id`, requireAdmin, (req, res) => {
    const item = db[name].find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    Object.assign(item, clean(schema, req.body || {}, true));
    save();
    res.json(item);
  });
  app.delete(`${base}/:id`, requireAdmin, (req, res) => {
    const i = db[name].findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    const [removed] = db[name].splice(i, 1);
    if (name === 'categories') db.menu.forEach((m) => { if (m.category === removed.id) m.category = ''; });
    deleteUploadIfUnused(removed.image);
    save();
    res.json({ ok: true });
  });
}

/* ---------------- uploads ---------------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }[file.mimetype];
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)),
});
app.post('/api/admin/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please choose a JPG, PNG, WEBP or GIF image (max 6 MB).' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

function deleteUploadIfUnused(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const json = JSON.stringify({ ...db, admin: null });
  if ((json.match(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length > 0) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => {});
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html')));

app.listen(PORT, () => {
  console.log(`Thalassery Thakkaram running at http://localhost:${PORT}`);
  console.log(`Admin panel:            http://localhost:${PORT}/admin`);
  if (db.admin.mustChange) console.log(`Default admin login: admin / ${DEFAULT_PASSWORD} (change it after first login)`);
});
