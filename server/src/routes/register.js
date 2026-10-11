import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

function calculateLiveCash(session) {
  const openedAt = session.opened_at;
  const closedAt = session.closed_at || new Date().toISOString();

  // Cash sales: positive cash payments with kind='sale'
  const cashSales = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments
    WHERE kind = 'sale' AND method = 'cash' AND amount > 0
      AND created_at >= ? AND created_at <= ?`).get(openedAt, closedAt).total;

  // Cash collections: positive cash payments on customer dues with kind='collection'
  const cashCollections = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments
    WHERE kind = 'collection' AND method = 'cash' AND amount > 0
      AND created_at >= ? AND created_at <= ?`).get(openedAt, closedAt).total;

  // Cash refunds: negative payments with method='cash'
  const cashRefunds = db.prepare(`SELECT ABS(COALESCE(SUM(amount), 0)) AS total FROM payments
    WHERE method = 'cash' AND amount < 0
      AND created_at >= ? AND created_at <= ?`).get(openedAt, closedAt).total;

  // Cash expenses: expenses paid with cash
  const cashExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
    WHERE payment_method = 'cash'
      AND created_at >= ? AND created_at <= ?`).get(openedAt, closedAt).total;

  const expectedCash = session.opening_cash + cashSales + cashCollections - cashRefunds - cashExpenses;

  return {
    opening_cash: session.opening_cash,
    cash_sales: cashSales,
    cash_collections: cashCollections,
    cash_refunds: cashRefunds,
    cash_expenses: cashExpenses,
    expected_cash: expectedCash
  };
}

// Get current open session for user or store
r.get('/register/current', requirePermission('register.view'), (req, res) => {
  // Check for an open session by this user, or if admin check any open session
  let session = db.prepare(`SELECT s.*, u.username, u.full_name FROM register_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.status = 'open' AND s.user_id = ?
    ORDER BY s.id DESC LIMIT 1`).get(req.user.id);

  if (!session && req.user.role === 'admin') {
    session = db.prepare(`SELECT s.*, u.username, u.full_name FROM register_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'open'
      ORDER BY s.id DESC LIMIT 1`).get();
  }

  if (!session) {
    return res.json({ session: null });
  }

  const breakdown = calculateLiveCash(session);

  // Recent transactions in this shift
  const payments = db.prepare(`SELECT p.*, s.invoice_no, c.name AS customer_name FROM payments p
    LEFT JOIN sales s ON s.id = p.sale_id
    LEFT JOIN customers c ON c.id = p.customer_id
    WHERE p.method = 'cash' AND p.created_at >= ?
    ORDER BY p.id DESC LIMIT 20`).all(session.opened_at).map(p => ({
      ...p, amount: fromMinor(p.amount)
    }));

  const expenses = db.prepare(`SELECT * FROM expenses
    WHERE payment_method = 'cash' AND created_at >= ?
    ORDER BY id DESC LIMIT 20`).all(session.opened_at).map(e => ({
      ...e, amount: fromMinor(e.amount)
    }));

  res.json({
    session: {
      ...session,
      opening_cash: fromMinor(session.opening_cash)
    },
    breakdown: {
      opening_cash: fromMinor(breakdown.opening_cash),
      cash_sales: fromMinor(breakdown.cash_sales),
      cash_collections: fromMinor(breakdown.cash_collections),
      cash_refunds: fromMinor(breakdown.cash_refunds),
      cash_expenses: fromMinor(breakdown.cash_expenses),
      expected_cash: fromMinor(breakdown.expected_cash)
    },
    recent_payments: payments,
    recent_expenses: expenses
  });
});

// Open a new register session
r.post('/register/open', requirePermission('register.manage'), (req, res) => {
  const { opening_cash: rawOpening = 0, notes = '' } = req.body || {};
  const openingCash = toMinor(rawOpening);

  const existing = db.prepare(`SELECT id FROM register_sessions WHERE user_id = ? AND status = 'open'`).get(req.user.id);
  if (existing) {
    return res.status(400).json({ error: 'You already have an open register session' });
  }

  const info = db.prepare(`INSERT INTO register_sessions (user_id, opening_cash, status, notes)
    VALUES (?, ?, 'open', ?)`).run(req.user.id, openingCash, notes);

  const session = db.prepare(`SELECT s.*, u.username, u.full_name FROM register_sessions s
    JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(info.lastInsertRowid);

  res.json({
    ok: true,
    session: {
      ...session,
      opening_cash: fromMinor(session.opening_cash)
    }
  });
});

// Close active register session
r.post('/register/close', requirePermission('register.close'), (req, res) => {
  const { closing_cash: rawClosing = 0, notes = '', session_id } = req.body || {};
  const closingCash = toMinor(rawClosing);

  let session;
  if (session_id && req.user.role === 'admin') {
    session = db.prepare(`SELECT * FROM register_sessions WHERE id = ? AND status = 'open'`).get(session_id);
  } else {
    session = db.prepare(`SELECT * FROM register_sessions WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1`).get(req.user.id);
  }

  if (!session) {
    return res.status(400).json({ error: 'No open register session found to close' });
  }

  const breakdown = calculateLiveCash(session);
  const expectedCash = breakdown.expected_cash;
  const difference = closingCash - expectedCash; // >0 excess, <0 shortage

  const combinedNotes = notes ? (session.notes ? `${session.notes} | Closing: ${notes}` : notes) : session.notes;

  db.prepare(`UPDATE register_sessions SET
    status = 'closed',
    closed_at = datetime('now'),
    closing_cash = ?,
    expected_cash = ?,
    difference = ?,
    notes = ?
    WHERE id = ?`).run(closingCash, expectedCash, difference, combinedNotes, session.id);

  const closed = db.prepare(`SELECT s.*, u.username, u.full_name FROM register_sessions s
    JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(session.id);

  res.json({
    ok: true,
    session: {
      ...closed,
      opening_cash: fromMinor(closed.opening_cash),
      closing_cash: fromMinor(closed.closing_cash),
      expected_cash: fromMinor(closed.expected_cash),
      difference: fromMinor(closed.difference)
    }
  });
});

// Get session history list
r.get('/register/sessions', requirePermission('register.view'), (req, res) => {
  const { limit = 50 } = req.query;
  const rows = db.prepare(`SELECT s.*, u.username, u.full_name FROM register_sessions s
    JOIN users u ON u.id = s.user_id
    ORDER BY s.id DESC LIMIT ?`).all(parseInt(limit, 10) || 50).map(s => ({
      ...s,
      opening_cash: fromMinor(s.opening_cash),
      closing_cash: s.closing_cash != null ? fromMinor(s.closing_cash) : null,
      expected_cash: s.expected_cash != null ? fromMinor(s.expected_cash) : null,
      difference: s.difference != null ? fromMinor(s.difference) : null
    }));

  res.json(rows);
});

export { r as registerRouter };
