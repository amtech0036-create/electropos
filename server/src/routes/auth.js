import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession,
  requireAuth, requirePermission, can
} from '../auth.js';

const r = Router();

r.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = createSession(user.id);
  res.setHeader('Set-Cookie', `electropos_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${12 * 3600}`);
  res.json({ id: user.id, username: user.username, full_name: user.full_name, role: user.role });
});

r.post('/auth/logout', (req, res) => {
  if (req.sessionToken) destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', 'electropos_session=; HttpOnly; Path=/; Max-Age=0');
  res.json({ ok: true });
});

r.get('/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.user);
});

// User management (admin only)
r.get('/users', requireAuth, requirePermission('user.manage'), (req, res) => {
  res.json(db.prepare('SELECT id, username, full_name, role, active FROM users ORDER BY id').all());
});

r.post('/users', requireAuth, requirePermission('user.manage'), (req, res) => {
  const { username, password, full_name = '', role } = req.body || {};
  if (!username || !password || !role) return res.status(400).json({ error: 'username, password, role required' });
  if (!['admin', 'cashier', 'stock_manager'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
      .run(username, hashPassword(password), full_name, role);
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Username already exists' });
    throw e;
  }
});

r.put('/users/:id', requireAuth, requirePermission('user.manage'), (req, res) => {
  const { password, full_name, role, active } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
  if (full_name !== undefined) db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(full_name, user.id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  if (active !== undefined) db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, user.id);
  res.json({ ok: true });
});

// Settings
r.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const { key, value } of rows) out[key] = value;
  res.json(out);
});

r.put('/settings', requireAuth, requirePermission('settings.manage'), (req, res) => {
  const allowed = ['shop_name', 'shop_address', 'shop_phone', 'currency', 'tax_rate_percent',
    'invoice_prefix', 'purchase_prefix', 'show_serial_on_invoice', 'warranty_terms', 'date_format'];
  const up = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.includes(k)) up.run(k, String(v));
  }
  res.json({ ok: true });
});

export { r as authRouter, can };
