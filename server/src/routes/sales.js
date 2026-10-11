import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

function nextInvoiceNo() {
  const year = new Date().getFullYear();
  const prefix = (db.prepare("SELECT value FROM settings WHERE key='invoice_prefix'").get()?.value) || 'INV-';
  const row = db.transaction(() => {
    db.prepare(`INSERT INTO invoice_counters (year, seq) VALUES (?, 1)
                ON CONFLICT(year) DO UPDATE SET seq = seq + 1`).run(year);
    return db.prepare('SELECT seq FROM invoice_counters WHERE year = ?').get(year);
  })();
  return `${prefix}${year}-${String(row.seq).padStart(5, '0')}`;
}

function getTaxRate() {
  const v = db.prepare("SELECT value FROM settings WHERE key='tax_rate_percent'").get()?.value || '0';
  return parseFloat(v) / 100;
}

// Create a sale (PRD §6). Transactional, idempotent, validates on the backend.
r.post('/sales', requirePermission('sale.create'), (req, res) => {
  const b = req.body || {};
  const { customer_id, items, payments, invoice_discount: invDiscRaw = 0, idempotency_key, notes = '' } = b;

  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  if (!Array.isArray(payments)) return res.status(400).json({ error: 'payments must be an array (empty = full due sale)' });

  // Idempotency: repeated submissions return the existing invoice, never double-charge (PRD 19.14)
  if (idempotency_key) {
    const existing = db.prepare('SELECT id, invoice_no FROM sales WHERE idempotency_key = ?').get(idempotency_key);
    if (existing) return res.json({ id: existing.id, invoice_no: existing.invoice_no, duplicate: true });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id || 1);
  if (!customer) return res.status(400).json({ error: 'Customer not found (use Walk-in Customer id 1)' });

  const taxRate = getTaxRate();
  const invDisc = toMinor(invDiscRaw);
  if (invDisc < 0) return res.status(400).json({ error: 'Discount cannot be negative' });

  const result = db.transaction(() => {
    let subtotal = 0, itemDiscTotal = 0;
    const lines = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) throw Object.assign(new Error(`Product ${item.product_id} not found or inactive`), { status: 400 });
      const qty = parseInt(item.qty, 10);
      if (!Number.isInteger(qty) || qty <= 0) throw Object.assign(new Error('Quantity must be a positive integer'), { status: 400 });
      const unitPrice = toMinor(item.unit_price);
      if (unitPrice < 0) throw Object.assign(new Error('Price cannot be negative'), { status: 400 });
      const discount = toMinor(item.discount || 0);
      if (discount < 0 || discount > unitPrice * qty) throw Object.assign(new Error('Invalid item discount'), { status: 400 });
      if (discount > 0 && !canDiscount(req.user, discount)) {
        throw Object.assign(new Error('Discount exceeds your permission limit'), { status: 403 });
      }
      // Negative stock disabled by default (PRD 4.4)
      const inStock = db.prepare('SELECT COALESCE(SUM(qty),0) AS s FROM stock_movements WHERE product_id = ?').get(product.id).s;
      if (inStock < qty) throw Object.assign(new Error(`Insufficient stock for ${product.name} (available: ${inStock})`), { status: 400 });

      // Serialized product handling (PRD §5)
      let selectedSerials = [];
      let serialInfoStr = '';
      if (product.tracking_type === 'serial') {
        const rawSerials = Array.isArray(item.serial_ids) ? item.serial_ids : (item.serial_id ? [item.serial_id] : []);
        if (rawSerials.length !== qty) {
          throw Object.assign(new Error(`Please select exactly ${qty} serial/IMEI unit(s) for ${product.name}`), { status: 400 });
        }
        for (const sid of rawSerials) {
          const sRow = db.prepare(`SELECT * FROM product_serials WHERE id = ? AND product_id = ?`).get(sid, product.id);
          if (!sRow) throw Object.assign(new Error(`Serial unit ${sid} not found for ${product.name}`), { status: 400 });
          if (sRow.status !== 'in_stock') {
            throw Object.assign(new Error(`Unit ${sRow.imei_1 || sRow.serial_no} is no longer in stock (${sRow.status})`), { status: 400 });
          }
          selectedSerials.push(sRow);
        }
        serialInfoStr = selectedSerials.map(s => {
          const parts = [];
          if (s.imei_1) parts.push(`IMEI: ${s.imei_1}`);
          if (s.imei_2) parts.push(`IMEI2: ${s.imei_2}`);
          if (s.serial_no) parts.push(`SN: ${s.serial_no}`);
          return parts.join(' | ');
        }).join(', ');
      }

      const lineTotal = unitPrice * qty - discount;
      subtotal += unitPrice * qty;
      itemDiscTotal += discount;
      lines.push({ product, qty, unitPrice, discount, lineTotal, selectedSerials, serialInfoStr });
    }
    if (invDisc < 0 || invDisc > subtotal - itemDiscTotal) {
      throw Object.assign(new Error('Invoice discount exceeds discountable amount'), { status: 400 });
    }
    const afterDisc = subtotal - itemDiscTotal - invDisc;
    const taxAmount = Math.round(afterDisc * taxRate);
    const total = afterDisc + taxAmount;

    // Payment validation (PRD §6.3). Full, partial, and credit (due) sales all allowed.
    const METHODS = ['cash', 'bkash', 'nagad', 'card', 'bank'];
    let cashReceived = 0, nonCash = 0;
    for (const p of payments) {
      const amt = toMinor(p.amount);
      if (!METHODS.includes(p.method)) throw Object.assign(new Error(`Invalid payment method: ${p.method}`), { status: 400 });
      if (!Number.isFinite(amt) || amt < 0) throw Object.assign(new Error('Payment amounts must be non-negative'), { status: 400 });
      if (p.method === 'cash') cashReceived += amt;
      else nonCash += amt;
    }
    // Empty payments = pure credit (due) sale — allowed per PRD §6.2
    const cashNeeded = Math.max(0, total - nonCash);
    const change = Math.max(0, cashReceived - cashNeeded); // change is NOT revenue (PRD 6.3)
    const cashApplied = cashReceived - change;
    const paid = nonCash + cashApplied; // amount actually applied to the sale
    const due = Math.max(0, total - paid);

    const invoiceNo = nextInvoiceNo();
    const saleInfo = db.prepare(`INSERT INTO sales
      (invoice_no, customer_id, user_id, subtotal, item_discount_total, invoice_discount, tax_amount,
       total, paid, due, change_given, status, idempotency_key, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)`)
      .run(invoiceNo, customer.id, req.user.id, subtotal, itemDiscTotal, invDisc, taxAmount,
        total, paid, due, change, idempotency_key || null, notes);
    const saleId = saleInfo.lastInsertRowid;

    const insertItem = db.prepare(`INSERT INTO sale_items
      (sale_id, product_id, product_name, product_sku, qty, unit_price, unit_cost, discount, line_total, serial_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertMove = db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, source_id, user_id)
      VALUES (?, ?, 'sale', 'sale', ?, ?)`);

    const updateSerial = db.prepare(`UPDATE product_serials SET
      status = 'sold',
      sale_id = ?,
      sale_item_id = ?,
      warranty_start_date = date('now'),
      warranty_end_date = date('now', '+' || ? || ' months')
      WHERE id = ?`);

    for (const l of lines) {
      const itemInfo = insertItem.run(saleId, l.product.id, l.product.name, l.product.sku, l.qty,
        l.unitPrice, l.product.purchase_cost, l.discount, l.lineTotal, l.serialInfoStr || '');
      const saleItemId = itemInfo.lastInsertRowid;

      // Update unit status to 'sold' and bind warranty
      const wMonths = l.product.warranty_months || 0;
      for (const s of l.selectedSerials) {
        updateSerial.run(saleId, saleItemId, wMonths, s.id);
      }

      insertMove.run(l.product.id, -l.qty, saleId, req.user.id); // stock out, exactly once (PRD 19.1)
    }

    const insertPay = db.prepare(`INSERT INTO payments (sale_id, customer_id, method, amount, kind, user_id)
      VALUES (?, ?, ?, ?, 'sale', ?)`);
    if (cashApplied > 0) insertPay.run(saleId, customer.id, 'cash', cashApplied, req.user.id);
    for (const p of payments) {
      if (p.method !== 'cash') insertPay.run(saleId, customer.id, p.method, toMinor(p.amount), req.user.id);
    }

    return { id: saleId, invoice_no: invoiceNo, total: fromMinor(total), due: fromMinor(due), change: fromMinor(change) };
  })();

  res.json(result);
});

// Discount permission limit per role (PRD 19.9)
const DISCOUNT_LIMITS = { admin: Infinity, cashier: toMinor(500), stock_manager: toMinor(100) };
function canDiscount(user, discountMinor) {
  const limit = DISCOUNT_LIMITS[user.role] ?? 0;
  return discountMinor <= limit;
}

// Sales list with filters
r.get('/sales', requirePermission('sale.view'), (req, res) => {
  const { from, to, customer_id, q, limit = 100 } = req.query;
  let sql = `SELECT s.*, cu.name AS customer_name, cu.phone AS customer_phone, u.username AS cashier_name FROM sales s
    JOIN customers cu ON cu.id = s.customer_id JOIN users u ON u.id = s.user_id WHERE 1=1`;
  const params = [];
  if (from) { sql += " AND date(s.created_at) >= date(?)"; params.push(from); }
  if (to) { sql += " AND date(s.created_at) <= date(?)"; params.push(to); }
  if (customer_id) { sql += ' AND s.customer_id = ?'; params.push(customer_id); }
  if (q) { sql += ' AND (s.invoice_no LIKE ? OR cu.name LIKE ? OR cu.phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  sql += ' ORDER BY s.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);
  const rows = db.prepare(sql).all(...params).map(s => ({
    ...s,
    subtotal: fromMinor(s.subtotal), invoice_discount: fromMinor(s.invoice_discount),
    tax_amount: fromMinor(s.tax_amount), total: fromMinor(s.total),
    paid: fromMinor(s.paid), due: fromMinor(s.due), change_given: fromMinor(s.change_given)
  }));
  res.json(rows);
});

// Full invoice data (for printing — PRD §15)
r.get('/sales/:id', (req, res) => {
  const s = db.prepare(`SELECT s.*, cu.name AS customer_name, cu.phone AS customer_phone,
      cu.address AS customer_address, u.username AS cashier_name FROM sales s
    JOIN customers cu ON cu.id = s.customer_id JOIN users u ON u.id = s.user_id WHERE s.id = ?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sale not found' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id).map(i => {
    const serials = db.prepare(`SELECT imei_1, imei_2, serial_no, warranty_end_date FROM product_serials WHERE sale_item_id = ?`).all(i.id);
    return {
      ...i,
      unit_price: fromMinor(i.unit_price),
      discount: fromMinor(i.discount),
      line_total: fromMinor(i.line_total),
      unit_cost: req.user?.role === 'admin' ? fromMinor(i.unit_cost) : undefined,
      serials
    };
  });
  const pays = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(s.id);
  const settings = {};
  for (const row of db.prepare('SELECT key, value FROM settings').all()) settings[row.key] = row.value;
  if (!req.user || req.user.role !== 'admin') { /* cost hidden from cashiers on invoice */ }
  res.json({
    ...s,
    subtotal: fromMinor(s.subtotal), item_discount_total: fromMinor(s.item_discount_total),
    invoice_discount: fromMinor(s.invoice_discount), tax_amount: fromMinor(s.tax_amount),
    total: fromMinor(s.total), paid: fromMinor(s.paid), due: fromMinor(s.due), change_given: fromMinor(s.change_given),
    items,
    payments: pays.map(p => ({ ...p, amount: fromMinor(p.amount) })),
    settings
  });
});

// Cancel sale (admin only, restocks, audit trail — PRD 6.2, 19.8)
r.post('/sales/:id/cancel', requirePermission('sale.cancel'), (req, res) => {
  const { reason = '' } = req.body || {};
  const s = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Sale not found' });
  if (s.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
  db.transaction(() => {
    db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(s.id);
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id);
    for (const i of items) {
      db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, source_id, reason, user_id)
        VALUES (?, ?, 'return', 'sale_cancel', ?, ?, ?)`).run(i.product_id, i.qty, s.id, reason || 'Sale cancelled', req.user.id);
    }
    // Void the payments (negative reversal) so cashbook reconciles
    db.prepare(`INSERT INTO payments (sale_id, customer_id, method, amount, kind, user_id)
      SELECT sale_id, customer_id, method, -amount, 'sale', user_id FROM payments WHERE sale_id = ?`).run(s.id);
  })();
  res.json({ ok: true });
});

export { r as salesRouter };
