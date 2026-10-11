import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

function nextPurchaseNo() {
  const year = new Date().getFullYear();
  const prefix = (db.prepare("SELECT value FROM settings WHERE key='purchase_prefix'").get()?.value) || 'PUR-';
  const row = db.transaction(() => {
    db.prepare(`INSERT INTO purchase_counters (year, seq) VALUES (?, 1)
                ON CONFLICT(year) DO UPDATE SET seq = seq + 1`).run(year);
    return db.prepare('SELECT seq FROM purchase_counters WHERE year = ?').get(year);
  })();
  return `${prefix}${year}-${String(row.seq).padStart(5, '0')}`;
}

// -------------------------------------------------------------
// SUPPLIERS (PRD §9)
// -------------------------------------------------------------

r.get('/suppliers', requirePermission('supplier.view'), (req, res) => {
  const { q = '' } = req.query;
  let sql = `SELECT s.*,
    COALESCE((SELECT SUM(total) FROM purchases p WHERE p.supplier_id = s.id AND p.status='finalized'), 0) AS total_purchases,
    COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) AS total_payments
    FROM suppliers s WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (s.name LIKE ? OR s.company_name LIKE ? OR s.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY s.name LIMIT 100';
  const rows = db.prepare(sql).all(...params).map(s => {
    const opening = s.opening_balance || 0;
    const purchases = s.total_purchases || 0;
    const payments = s.total_payments || 0;
    const balance = opening + purchases - payments;
    return {
      ...s,
      opening_balance: fromMinor(opening),
      total_purchases: fromMinor(purchases),
      total_payments: fromMinor(payments),
      outstanding_balance: fromMinor(balance)
    };
  });
  res.json(rows);
});

r.post('/suppliers', requirePermission('supplier.manage'), (req, res) => {
  const { name, company_name = '', phone = '', address = '', opening_balance = 0, notes = '' } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Supplier name required' });
  const openMinor = toMinor(opening_balance);
  const info = db.prepare(`INSERT INTO suppliers (name, company_name, phone, address, opening_balance, notes)
    VALUES (?, ?, ?, ?, ?, ?)`).run(name, company_name, phone, address, openMinor, notes);
  res.json({ id: info.lastInsertRowid });
});

r.get('/suppliers/:id', requirePermission('supplier.view'), (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Supplier not found' });

  const purchases = db.prepare(`SELECT p.id, p.purchase_no, p.supplier_invoice_no, p.purchase_date,
    p.total, p.paid, p.due, p.status, p.created_at FROM purchases p
    WHERE p.supplier_id = ? ORDER BY p.id DESC`).all(s.id).map(p => ({
      ...p,
      total: fromMinor(p.total),
      paid: fromMinor(p.paid),
      due: fromMinor(p.due)
    }));

  const payments = db.prepare(`SELECT sp.id, sp.purchase_id, sp.method, sp.amount, sp.kind, sp.notes, sp.created_at,
    p.purchase_no
    FROM supplier_payments sp
    LEFT JOIN purchases p ON p.id = sp.purchase_id
    WHERE sp.supplier_id = ? ORDER BY sp.id DESC`).all(s.id).map(p => ({
      ...p,
      amount: fromMinor(p.amount)
    }));

  const totals = db.prepare(`SELECT
    COALESCE((SELECT SUM(total) FROM purchases WHERE supplier_id = ? AND status='finalized'), 0) AS tp,
    COALESCE((SELECT SUM(amount) FROM supplier_payments WHERE supplier_id = ?), 0) AS tpay`).get(s.id, s.id);

  const opening = s.opening_balance || 0;
  const tp = totals.tp || 0;
  const tpay = totals.tpay || 0;
  const balance = opening + tp - tpay;

  // Build combined chronological ledger
  const ledgerEntries = [];
  if (opening !== 0) {
    ledgerEntries.push({
      date: s.created_at,
      type: 'opening',
      reference: 'Opening Balance',
      debit: 0, // we owe (credit)
      credit: opening,
      notes: 'Initial recorded balance'
    });
  }

  const rawPurchases = db.prepare(`SELECT id, purchase_no, total, created_at, notes FROM purchases
    WHERE supplier_id = ? AND status='finalized' ORDER BY id ASC`).all(s.id);
  for (const p of rawPurchases) {
    ledgerEntries.push({
      date: p.created_at,
      type: 'purchase',
      reference: p.purchase_no,
      debit: 0,
      credit: p.total, // increases liability
      notes: p.notes
    });
  }

  const rawPayments = db.prepare(`SELECT sp.id, sp.amount, sp.method, sp.kind, sp.notes, sp.created_at, p.purchase_no
    FROM supplier_payments sp LEFT JOIN purchases p ON p.id = sp.purchase_id
    WHERE sp.supplier_id = ? ORDER BY sp.id ASC`).all(s.id);
  for (const p of rawPayments) {
    ledgerEntries.push({
      date: p.created_at,
      type: p.kind === 'purchase' ? 'purchase_payment' : 'payment',
      reference: p.purchase_no ? `Paid for ${p.purchase_no} (${p.method})` : `Payment (${p.method})`,
      debit: p.amount, // payment reduces liability
      credit: 0,
      notes: p.notes
    });
  }

  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  const ledger = ledgerEntries.map(e => {
    running += (e.credit - e.debit);
    return {
      ...e,
      debit: fromMinor(e.debit),
      credit: fromMinor(e.credit),
      balance: fromMinor(running)
    };
  });

  res.json({
    ...s,
    opening_balance: fromMinor(opening),
    total_purchases: fromMinor(tp),
    total_payments: fromMinor(tpay),
    outstanding_balance: fromMinor(balance),
    purchases,
    payments,
    ledger
  });
});

r.put('/suppliers/:id', requirePermission('supplier.manage'), (req, res) => {
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Supplier not found' });
  const { name, company_name, phone, address, opening_balance, notes } = req.body || {};
  db.prepare(`UPDATE suppliers SET
    name = ?, company_name = ?, phone = ?, address = ?, opening_balance = ?, notes = ?
    WHERE id = ?`).run(
    name ?? s.name,
    company_name ?? s.company_name,
    phone ?? s.phone,
    address ?? s.address,
    opening_balance !== undefined ? toMinor(opening_balance) : s.opening_balance,
    notes ?? s.notes,
    s.id
  );
  res.json({ ok: true });
});

// Record a payment to supplier (reduces outstanding balance without creating a purchase)
r.post('/suppliers/:id/payments', requirePermission('purchase.manage'), (req, res) => {
  const { amount, method = 'cash', notes = '' } = req.body || {};
  const minor = toMinor(amount);
  if (!minor || minor <= 0) return res.status(400).json({ error: 'Amount must be positive' });
  if (!['cash', 'bkash', 'nagad', 'card', 'bank'].includes(method)) {
    return res.status(400).json({ error: 'Invalid payment method' });
  }
  const s = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Supplier not found' });

  db.prepare(`INSERT INTO supplier_payments (supplier_id, method, amount, kind, notes, user_id)
    VALUES (?, ?, ?, 'payment', ?, ?)`).run(s.id, method, minor, notes, req.user.id);

  res.json({ ok: true });
});

// -------------------------------------------------------------
// PURCHASES (PRD §7)
// -------------------------------------------------------------

r.get('/purchases', requirePermission('purchase.view'), (req, res) => {
  const { from, to, supplier_id, status, q, limit = 100 } = req.query;
  let sql = `SELECT p.*, s.name AS supplier_name, s.company_name AS supplier_company, u.username AS user_name
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN users u ON u.id = p.user_id
    WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND date(p.purchase_date) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(p.purchase_date) <= date(?)'; params.push(to); }
  if (supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(supplier_id); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (q) {
    sql += ' AND (p.purchase_no LIKE ? OR p.supplier_invoice_no LIKE ? OR s.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY p.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);

  const rows = db.prepare(sql).all(...params).map(p => ({
    ...p,
    subtotal: fromMinor(p.subtotal),
    discount: fromMinor(p.discount),
    tax_amount: fromMinor(p.tax_amount),
    total: fromMinor(p.total),
    paid: fromMinor(p.paid),
    due: fromMinor(p.due)
  }));
  res.json(rows);
});

r.get('/purchases/:id', requirePermission('purchase.view'), (req, res) => {
  const p = db.prepare(`SELECT p.*, s.name AS supplier_name, s.company_name AS supplier_company,
    s.phone AS supplier_phone, s.address AS supplier_address, u.username AS user_name
    FROM purchases p
    JOIN suppliers s ON s.id = p.supplier_id
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Purchase not found' });

  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id).map(i => ({
    ...i,
    unit_cost: fromMinor(i.unit_cost),
    discount: fromMinor(i.discount),
    line_total: fromMinor(i.line_total)
  }));

  const payments = db.prepare('SELECT * FROM supplier_payments WHERE purchase_id = ?').all(p.id).map(sp => ({
    ...sp,
    amount: fromMinor(sp.amount)
  }));

  res.json({
    ...p,
    subtotal: fromMinor(p.subtotal),
    discount: fromMinor(p.discount),
    tax_amount: fromMinor(p.tax_amount),
    total: fromMinor(p.total),
    paid: fromMinor(p.paid),
    due: fromMinor(p.due),
    items,
    payments
  });
});

// Create purchase (Draft or Finalized)
r.post('/purchases', requirePermission('purchase.manage'), (req, res) => {
  const b = req.body || {};
  const {
    supplier_id,
    supplier_invoice_no = '',
    purchase_date = new Date().toISOString().slice(0, 10),
    items,
    discount: discRaw = 0,
    paid: paidRaw = 0,
    payment_method = 'cash',
    status: reqStatus = 'draft',
    finalize = false,
    idempotency_key,
    notes = ''
  } = b;

  if (!supplier_id) return res.status(400).json({ error: 'Supplier required' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Items list cannot be empty' });

  // Idempotency check
  if (idempotency_key) {
    const existing = db.prepare('SELECT id, purchase_no FROM purchases WHERE idempotency_key = ?').get(idempotency_key);
    if (existing) return res.json({ id: existing.id, purchase_no: existing.purchase_no, duplicate: true });
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier_id);
  if (!supplier) return res.status(400).json({ error: 'Supplier not found' });

  const status = (finalize || reqStatus === 'finalized') ? 'finalized' : 'draft';
  const purchaseDisc = toMinor(discRaw);
  if (purchaseDisc < 0) return res.status(400).json({ error: 'Discount cannot be negative' });

  const result = db.transaction(() => {
    let subtotal = 0;
    const lines = [];

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw Object.assign(new Error(`Product ID ${item.product_id} not found`), { status: 400 });
      const qty = parseInt(item.qty, 10);
      if (!Number.isInteger(qty) || qty <= 0) throw Object.assign(new Error('Item quantity must be a positive integer'), { status: 400 });
      const unitCost = toMinor(item.unit_cost !== undefined ? item.unit_cost : product.purchase_cost);
      if (unitCost < 0) throw Object.assign(new Error('Unit cost cannot be negative'), { status: 400 });
      const itemDisc = toMinor(item.discount || 0);
      if (itemDisc < 0 || itemDisc > unitCost * qty) throw Object.assign(new Error('Invalid item discount'), { status: 400 });

      const lineTotal = unitCost * qty - itemDisc;
      subtotal += lineTotal;
      lines.push({ product, qty, unitCost, itemDisc, lineTotal });
    }

    if (purchaseDisc > subtotal) {
      throw Object.assign(new Error('Purchase discount cannot exceed subtotal'), { status: 400 });
    }

    const total = subtotal - purchaseDisc;
    const paidMinor = Math.min(total, toMinor(paidRaw || 0));
    const dueMinor = Math.max(0, total - paidMinor);

    const purchaseNo = nextPurchaseNo();
    const info = db.prepare(`INSERT INTO purchases
      (purchase_no, supplier_invoice_no, supplier_id, user_id, purchase_date, subtotal, discount,
       total, paid, due, status, payment_method, idempotency_key, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      purchaseNo, supplier_invoice_no, supplier.id, req.user.id, purchase_date,
      subtotal, purchaseDisc, total, paidMinor, dueMinor, status, payment_method,
      idempotency_key || null, notes
    );

    const purchaseId = info.lastInsertRowid;

    const insertItem = db.prepare(`INSERT INTO purchase_items
      (purchase_id, product_id, product_name, product_sku, qty, unit_cost, discount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    const insertMove = db.prepare(`INSERT INTO stock_movements
      (product_id, qty, type, source_type, source_id, user_id)
      VALUES (?, ?, 'purchase', 'purchase', ?, ?)`);

    const updateCost = db.prepare(`UPDATE products SET purchase_cost = ? WHERE id = ?`);

    for (const l of lines) {
      insertItem.run(purchaseId, l.product.id, l.product.name, l.product.sku, l.qty,
        l.unitCost, l.itemDisc, l.lineTotal);

      if (status === 'finalized') {
        // Increment stock
        insertMove.run(l.product.id, l.qty, purchaseId, req.user.id);
        // Update product purchase cost to latest purchase cost
        updateCost.run(l.unitCost, l.product.id);
      }
    }

    if (status === 'finalized' && paidMinor > 0) {
      db.prepare(`INSERT INTO supplier_payments (purchase_id, supplier_id, method, amount, kind, notes, user_id)
        VALUES (?, ?, ?, ?, 'purchase', ?, ?)`).run(
        purchaseId, supplier.id, payment_method || 'cash', paidMinor, `Payment for ${purchaseNo}`, req.user.id
      );
    }

    return {
      id: purchaseId,
      purchase_no: purchaseNo,
      status,
      subtotal: fromMinor(subtotal),
      total: fromMinor(total),
      paid: fromMinor(paidMinor),
      due: fromMinor(dueMinor)
    };
  })();

  res.json(result);
});

// Finalize a draft purchase
r.post('/purchases/:id/finalize', requirePermission('purchase.manage'), (req, res) => {
  const p = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Purchase not found' });
  if (p.status !== 'draft') return res.status(400).json({ error: `Cannot finalize purchase with status '${p.status}'` });

  const { paid: paidRaw, payment_method = 'cash' } = req.body || {};

  db.transaction(() => {
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);

    const insertMove = db.prepare(`INSERT INTO stock_movements
      (product_id, qty, type, source_type, source_id, user_id)
      VALUES (?, ?, 'purchase', 'purchase', ?, ?)`);

    const updateCost = db.prepare(`UPDATE products SET purchase_cost = ? WHERE id = ?`);

    for (const item of items) {
      insertMove.run(item.product_id, item.qty, p.id, req.user.id);
      updateCost.run(item.unit_cost, item.product_id);
    }

    let paidMinor = p.paid;
    let dueMinor = p.due;

    if (paidRaw !== undefined) {
      paidMinor = Math.min(p.total, toMinor(paidRaw));
      dueMinor = Math.max(0, p.total - paidMinor);
    }

    db.prepare(`UPDATE purchases SET status = 'finalized', paid = ?, due = ?, payment_method = ? WHERE id = ?`)
      .run(paidMinor, dueMinor, payment_method, p.id);

    if (paidMinor > 0) {
      // Remove any previous payment recorded for this purchase draft
      db.prepare(`DELETE FROM supplier_payments WHERE purchase_id = ?`).run(p.id);
      db.prepare(`INSERT INTO supplier_payments (purchase_id, supplier_id, method, amount, kind, notes, user_id)
        VALUES (?, ?, ?, ?, 'purchase', ?, ?)`).run(
        p.id, p.supplier_id, payment_method, paidMinor, `Payment for ${p.purchase_no}`, req.user.id
      );
    }
  })();

  res.json({ ok: true, status: 'finalized' });
});

// Cancel a purchase (restocks/reverses if finalized)
r.post('/purchases/:id/cancel', requirePermission('purchase.manage'), (req, res) => {
  const { reason = '' } = req.body || {};
  const p = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Purchase not found' });
  if (p.status === 'cancelled') return res.status(400).json({ error: 'Purchase is already cancelled' });

  db.transaction(() => {
    if (p.status === 'finalized') {
      const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(p.id);

      // Verify stock availability so stock does not go negative
      for (const item of items) {
        const inStock = db.prepare('SELECT COALESCE(SUM(qty), 0) AS s FROM stock_movements WHERE product_id = ?').get(item.product_id).s;
        if (inStock < item.qty) {
          throw Object.assign(new Error(`Cannot cancel: stock for ${item.product_name} would become negative (${inStock} available, ${item.qty} needed)`), { status: 400 });
        }
      }

      // Decrement stock
      const insertMove = db.prepare(`INSERT INTO stock_movements
        (product_id, qty, type, source_type, source_id, reason, user_id)
        VALUES (?, ?, 'return', 'purchase_cancel', ?, ?, ?)`);

      for (const item of items) {
        insertMove.run(item.product_id, -item.qty, p.id, reason || 'Purchase cancelled', req.user.id);
      }

      // Void payments
      db.prepare(`INSERT INTO supplier_payments (purchase_id, supplier_id, method, amount, kind, notes, user_id)
        SELECT purchase_id, supplier_id, method, -amount, 'purchase', 'Reversal: ' || ?, ?
        FROM supplier_payments WHERE purchase_id = ?`).run(reason || 'Purchase cancelled', req.user.id, p.id);
    }

    db.prepare("UPDATE purchases SET status = 'cancelled' WHERE id = ?").run(p.id);
  })();

  res.json({ ok: true, status: 'cancelled' });
});

export { r as purchasesRouter };
