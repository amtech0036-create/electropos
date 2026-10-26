import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_HOURS = 12;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function getTokenFromRequest(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)electropos_session=([^;]+)/);
  return m ? m[1] : null;
}

// Attaches req.user if a valid session exists; never rejects.
export function loadUser(req, res, next) {
  const token = getTokenFromRequest(req);
  if (token) {
    const row = db.prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.is_super_admin, u.active
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND u.active = 1`
    ).get(token);
    if (row) {
      req.user = row;
      req.sessionToken = token;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  if (req.user.is_super_admin !== 1 && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Super Admin privileges required' });
  }
  next();
}

// Roles allowed for each sensitive action (PRD §2, §19)
const PERMISSIONS = {
  admin: ['*'],
  cashier: ['sale.create', 'sale.view', 'sale.return', 'customer.create', 'customer.view', 'product.view', 'payment.collect', 'expense.view', 'expense.create', 'register.view', 'register.manage', 'register.close'],
  stock_manager: ['product.view', 'product.manage', 'product.cost', 'stock.manage', 'stock.adjust', 'purchase.view', 'purchase.manage', 'supplier.view', 'supplier.manage', 'sale.view', 'sale.return', 'expense.view', 'expense.create', 'register.view']
};

export function can(user, permission) {
  if (!user) return false;
  const list = PERMISSIONS[user.role] || [];
  return list.includes('*') || list.includes(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    if (!can(req.user, permission)) return res.status(403).json({ error: 'Not allowed' });
    next();
  };
}
