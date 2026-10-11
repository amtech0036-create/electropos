import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

const DEFAULT_CATEGORIES = [
  'Shop rent',
  'Electricity and utilities',
  'Employee salaries',
  'Transport and delivery',
  'Internet and phone',
  'Repair and maintenance',
  'Packaging',
  'Other expenses'
];

// List categories
r.get('/expenses/categories', (req, res) => {
  const existing = db.prepare('SELECT DISTINCT category FROM expenses').all().map(x => x.category);
  const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...existing])).sort();
  res.json(combined);
});

// List expenses with filters
r.get('/expenses', requirePermission('expense.view'), (req, res) => {
  const { from, to, category, payment_method, limit = 200 } = req.query;
  let sql = `SELECT e.*, u.username, u.full_name FROM expenses e
    LEFT JOIN users u ON u.id = e.user_id
    WHERE 1=1`;
  const params = [];

  if (from) { sql += ' AND date(e.date) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(e.date) <= date(?)'; params.push(to); }
  if (category) { sql += ' AND e.category = ?'; params.push(category); }
  if (payment_method) { sql += ' AND e.payment_method = ?'; params.push(payment_method); }

  sql += ' ORDER BY e.date DESC, e.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 200);

  const rows = db.prepare(sql).all(...params).map(e => ({
    ...e,
    amount: fromMinor(e.amount)
  }));

  res.json(rows);
});

// Expenses summary by category
r.get('/expenses/summary', requirePermission('expense.view'), (req, res) => {
  const { from, to } = req.query;
  let dateFilter = '1=1';
  const params = [];
  if (from && to) {
    dateFilter = 'date(e.date) BETWEEN date(?) AND date(?)';
    params.push(from, to);
  }

  const byCategory = db.prepare(`SELECT e.category,
      COALESCE(SUM(e.amount), 0) AS total_minor,
      COUNT(*) AS count
    FROM expenses e WHERE ${dateFilter}
    GROUP BY e.category ORDER BY total_minor DESC`).all(...params);

  const overall = db.prepare(`SELECT
      COALESCE(SUM(amount), 0) AS total_minor,
      COUNT(*) AS count
    FROM expenses e WHERE ${dateFilter}`).get(...params);

  const total = fromMinor(overall.total_minor);

  const breakdown = byCategory.map(c => {
    const amt = fromMinor(c.total_minor);
    return {
      category: c.category,
      amount: amt,
      count: c.count,
      percent: total > 0 ? Math.round((amt / total) * 100) : 0
    };
  });

  res.json({
    total,
    count: overall.count,
    by_category: breakdown
  });
});

// Record expense
r.post('/expenses', requirePermission('expense.create'), (req, res) => {
  const { date = new Date().toISOString().slice(0, 10), category, amount, payment_method = 'cash', description = '' } = req.body || {};
  if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required' });
  const minor = toMinor(amount);
  if (!minor || minor <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

  const validMethods = ['cash', 'bank', 'card', 'bkash', 'nagad'];
  if (!validMethods.includes(payment_method)) return res.status(400).json({ error: 'Invalid payment method' });

  const info = db.prepare(`INSERT INTO expenses (date, category, amount, payment_method, description, user_id)
    VALUES (?, ?, ?, ?, ?, ?)`).run(date, category.trim(), minor, payment_method, description.trim(), req.user.id);

  res.json({
    id: info.lastInsertRowid,
    date,
    category: category.trim(),
    amount: fromMinor(minor),
    payment_method,
    description: description.trim()
  });
});

// Delete expense (admin only)
r.delete('/expenses/:id', requirePermission('expense.manage'), (req, res) => {
  const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!exp) return res.status(404).json({ error: 'Expense not found' });

  db.prepare('DELETE FROM expenses WHERE id = ?').run(exp.id);
  res.json({ ok: true });
});

export { r as expensesRouter };
