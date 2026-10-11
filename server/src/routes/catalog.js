import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission, can } from '../auth.js';

const r = Router();
r.use(requireAuth);

function stockQty(productId) {
  const row = db.prepare('SELECT COALESCE(SUM(qty), 0) AS s FROM stock_movements WHERE product_id = ?').get(productId);
  return row.s;
}

function serialize(p, withStock = true) {
  const out = {
    ...p,
    purchase_cost: fromMinor(p.purchase_cost),
    selling_price: fromMinor(p.selling_price),
    wholesale_price: p.wholesale_price === null ? null : fromMinor(p.wholesale_price)
  };
  if (withStock) out.stock = stockQty(p.id);
  return out;
}

// List/search products (PRD 4.3: name, SKU, barcode, brand, model)
r.get('/products', (req, res) => {
  const { q = '', category_id, include_inactive } = req.query;
  let sql = `SELECT p.*, c.name AS category_name FROM products p
             LEFT JOIN categories c ON c.id = p.category_id WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ? OR p.model LIKE ?
      OR p.id IN (SELECT product_id FROM product_serials WHERE imei_1 LIKE ? OR imei_2 LIKE ? OR serial_no LIKE ?))`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like);
  }
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  if (!include_inactive) sql += ' AND p.active = 1';
  sql += ' ORDER BY p.name';
  const rows = db.prepare(sql).all(...params).map(p => serialize(p));
  // Only hide cost from users who can't see it
  if (!can(req.user, 'product.cost')) {
    for (const row of rows) delete row.purchase_cost;
  }
  res.json(rows);
});

r.get('/products/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, c.name AS category_name FROM products p
    LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const out = serialize(p);
  if (!can(req.user, 'product.cost')) delete out.purchase_cost;
  res.json(out);
});

function nextSku(name) {
  const prefix = (name.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'PRD').toUpperCase();
  const row = db.prepare("SELECT sku FROM products WHERE sku LIKE ? ORDER BY id DESC LIMIT 1").get(`${prefix}-%`);
  const lastNum = row ? parseInt(row.sku.split('-')[1], 10) || 0 : 0;
  return `${prefix}-${String(lastNum + 1).padStart(4, '0')}`;
}

r.post('/products', requirePermission('product.manage'), (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.category_id) return res.status(400).json({ error: 'name and category_id required' });
  if (b.selling_price === undefined || b.purchase_cost === undefined)
    return res.status(400).json({ error: 'purchase_cost and selling_price required' });
  const sku = b.sku || nextSku(b.name);
  try {
    const info = db.prepare(`INSERT INTO products
      (name, category_id, brand, model, sku, barcode, purchase_cost, selling_price, wholesale_price,
       min_stock_alert, tracking_type, warranty_months, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(b.name, b.category_id, b.brand || '', b.model || '', sku, b.barcode || null,
        toMinor(b.purchase_cost), toMinor(b.selling_price),
        b.wholesale_price != null ? toMinor(b.wholesale_price) : null,
        b.min_stock_alert || 0, b.tracking_type || 'quantity', b.warranty_months || null);
    if (b.opening_stock > 0) {
      db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, user_id, reason)
                  VALUES (?, ?, 'opening', 'opening', ?, 'Opening stock')`)
        .run(info.lastInsertRowid, b.opening_stock, req.user.id);
    }
    res.json({ id: info.lastInsertRowid, sku });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'SKU or barcode already exists' });
    throw e;
  }
});

r.put('/products/:id', requirePermission('product.manage'), (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const b = req.body || {};
  try {
    db.prepare(`UPDATE products SET name=?, category_id=?, brand=?, model=?, sku=?, barcode=?,
      purchase_cost=?, selling_price=?, wholesale_price=?, min_stock_alert=?, tracking_type=?, warranty_months=?, active=?
      WHERE id=?`)
      .run(
        b.name ?? p.name, b.category_id ?? p.category_id, b.brand ?? p.brand, b.model ?? p.model,
        b.sku ?? p.sku, b.barcode !== undefined ? (b.barcode || null) : p.barcode,
        b.purchase_cost !== undefined ? toMinor(b.purchase_cost) : p.purchase_cost,
        b.selling_price !== undefined ? toMinor(b.selling_price) : p.selling_price,
        b.wholesale_price !== undefined ? (b.wholesale_price != null ? toMinor(b.wholesale_price) : null) : p.wholesale_price,
        b.min_stock_alert ?? p.min_stock_alert, b.tracking_type ?? p.tracking_type,
        b.warranty_months ?? p.warranty_months, b.active ?? p.active, p.id
      );
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'SKU or barcode already exists' });
    throw e;
  }
});

// Deactivate instead of delete (PRD 4.4 — products used in transactions are never hard-deleted)
r.delete('/products/:id', requirePermission('product.manage'), (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Stock adjustment with required reason (PRD 12)
r.post('/products/:id/adjust', requirePermission('stock.adjust'), (req, res) => {
  const { qty_change, reason } = req.body || {};
  if (!reason) return res.status(400).json({ error: 'reason required' });
  if (!Number.isInteger(qty_change) || qty_change === 0) return res.status(400).json({ error: 'qty_change must be a non-zero integer' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const current = stockQty(product.id);
  if (current + qty_change < 0) return res.status(400).json({ error: 'Adjustment would make stock negative (disabled by default)' });
  db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, reason, user_id)
              VALUES (?, ?, 'adjustment', 'adjustment', ?, ?)`)
    .run(product.id, qty_change, reason, req.user.id);
  res.json({ ok: true, stock: current + qty_change });
});

// Stock movement history for a product
r.get('/products/:id/movements', (req, res) => {
  const rows = db.prepare(`SELECT m.*, u.username FROM stock_movements m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.product_id = ? ORDER BY m.id DESC LIMIT 200`).all(req.params.id);
  res.json(rows);
});

// Global stock movements log (PRD §12 — movement history page)
r.get('/stock/movements', requirePermission('stock.manage'), (req, res) => {
  const { product_id, type, from, to, limit = 300 } = req.query;
  let sql = `SELECT m.*, p.name AS product_name, p.sku AS product_sku, u.username
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE 1=1`;
  const params = [];
  if (product_id) { sql += ' AND m.product_id = ?'; params.push(product_id); }
  if (type) { sql += ' AND m.type = ?'; params.push(type); }
  if (from) { sql += ' AND date(m.created_at) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(m.created_at) <= date(?)'; params.push(to); }
  sql += ' ORDER BY m.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 300);
  res.json(db.prepare(sql).all(...params));
});

// Low-stock products report (PRD §12)
r.get('/stock/low', requirePermission('stock.manage'), (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.name, p.sku, p.brand, p.category_id, c.name AS category_name,
      p.min_stock_alert, p.purchase_cost, p.selling_price,
      COALESCE((SELECT SUM(qty) FROM stock_movements WHERE product_id = p.id), 0) AS stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.min_stock_alert > 0
      AND stock <= p.min_stock_alert
    ORDER BY stock ASC, p.name`).all().map(p => ({
      ...p,
      purchase_cost: fromMinor(p.purchase_cost),
      selling_price: fromMinor(p.selling_price)
    }));
  res.json(rows);
});

// Stock CSV export (PRD §12)
r.get('/stock/export.csv', requirePermission('stock.manage'), (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.name, p.sku, p.brand, p.barcode,
      c.name AS category, p.purchase_cost, p.selling_price, p.min_stock_alert,
      COALESCE((SELECT SUM(qty) FROM stock_movements WHERE product_id = p.id), 0) AS stock
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 ORDER BY p.name`).all();

  const header = 'ID,SKU,Name,Brand,Barcode,Category,Purchase Cost,Selling Price,Stock,Min Alert,Stock Value';
  const lines = rows.map(r => {
    const cost = fromMinor(r.purchase_cost);
    const price = fromMinor(r.selling_price);
    const val = (cost * r.stock).toFixed(2);
    return [r.id, r.sku, `"${r.name}"`, `"${r.brand || ''}"`, r.barcode || '', `"${r.category || ''}"`,
      cost.toFixed(2), price.toFixed(2), r.stock, r.min_stock_alert, val].join(',');
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stock_report.csv');
  res.send([header, ...lines].join('\n'));
});

// Categories
r.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

r.post('/categories', requirePermission('product.manage'), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: 'Category already exists' });
  }
});

r.put('/categories/:id', requirePermission('product.manage'), (req, res) => {
  const { name, active } = req.body || {};
  if (name) db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, req.params.id);
  if (active !== undefined) db.prepare('UPDATE categories SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// Customers
r.get('/customers', (req, res) => {
  const { q = '' } = req.query;
  let sql = `SELECT cu.*,
    COALESCE((SELECT SUM(total) FROM sales s WHERE s.customer_id = cu.id AND s.status='completed'), 0) AS total_purchases,
    COALESCE((SELECT SUM(amount) FROM payments p WHERE p.customer_id = cu.id), 0) AS total_payments
    FROM customers cu WHERE 1=1`;
  const params = [];
  if (q) { sql += ' AND (cu.name LIKE ? OR cu.phone LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY cu.is_walkin DESC, cu.name LIMIT 100';
  const rows = db.prepare(sql).all(...params).map(c => ({
    ...c, total_purchases: fromMinor(c.total_purchases), total_payments: fromMinor(c.total_payments),
    outstanding_due: fromMinor(c.total_purchases - c.total_payments)
  }));
  res.json(rows);
});

r.post('/customers', (req, res) => {
  let { name = '', phone = '', address = '' } = req.body || {};
  name = typeof name === 'string' ? name.trim() : '';
  phone = typeof phone === 'string' ? phone.trim() : '';
  address = typeof address === 'string' ? address.trim() : '';
  if (!name) return res.status(400).json({ error: 'name required' });

  // If phone was not provided separately, check if name contains a phone number at the end, e.g. "Rahim 01700000000"
  if (!phone) {
    const match = name.match(/^(.*?)\s+([+0-9\-()]{7,20})$/);
    if (match) {
      name = match[1].trim();
      phone = match[2].trim();
    }
  }

  const info = db.prepare('INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)').run(name, phone, address);
  res.json({ id: info.lastInsertRowid, name, phone, address });
});

r.get('/customers/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  const sales = db.prepare(`SELECT id, invoice_no, total, paid, due, status, created_at FROM sales
    WHERE customer_id = ? ORDER BY id DESC`).all(c.id);
  const payments = db.prepare(`SELECT id, method, amount, kind, created_at FROM payments
    WHERE customer_id = ? ORDER BY id DESC`).all(c.id);
  const totals = db.prepare(`SELECT
    COALESCE((SELECT SUM(total) FROM sales WHERE customer_id = ? AND status='completed'), 0) AS tp,
    COALESCE((SELECT SUM(amount) FROM payments WHERE customer_id = ?), 0) AS tpay`).get(c.id, c.id);
  res.json({
    ...c,
    total_purchases: fromMinor(totals.tp),
    total_payments: fromMinor(totals.tpay),
    outstanding_due: fromMinor(totals.tp - totals.tpay),
    sales: sales.map(s => ({ ...s, total: fromMinor(s.total), paid: fromMinor(s.paid), due: fromMinor(s.due) })),
    payments: payments.map(p => ({ ...p, amount: fromMinor(p.amount) }))
  });
});

// Record a due collection from customer (reduces due, does not create a sale — PRD 19.4)
r.post('/customers/:id/collections', requirePermission('payment.collect'), (req, res) => {
  const { amount, method = 'cash' } = req.body || {};
  const minor = toMinor(amount);
  if (!minor || minor <= 0) return res.status(400).json({ error: 'amount must be positive' });
  if (!['cash', 'bkash', 'nagad', 'card', 'bank'].includes(method)) return res.status(400).json({ error: 'Invalid method' });
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Customer not found' });
  db.prepare(`INSERT INTO payments (customer_id, method, amount, kind, user_id) VALUES (?, ?, ?, 'collection', ?)`)
    .run(c.id, method, minor, req.user.id);
  res.json({ ok: true });
});

export { r as apiRouter };
