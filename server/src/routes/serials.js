import { Router } from 'express';
import { db, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

// Get serials for a specific product
r.get('/products/:id/serials', requirePermission('product.view'), (req, res) => {
  const { status = 'all' } = req.query;
  let sql = `SELECT ps.*, s.invoice_no, c.name AS customer_name, c.phone AS customer_phone FROM product_serials ps
    LEFT JOIN sales s ON s.id = ps.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE ps.product_id = ?`;
  const params = [req.params.id];
  if (status !== 'all') {
    sql += ' AND ps.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY ps.id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Add serialized units for a product (PRD §5.1)
r.post('/products/:id/serials', requirePermission('stock.manage'), (req, res) => {
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  if (prod.tracking_type !== 'serial') {
    return res.status(400).json({ error: 'This product is quantity-tracked, not serialized' });
  }

  const body = req.body || {};
  const units = Array.isArray(body.serials) ? body.serials : [body];
  if (units.length === 0) return res.status(400).json({ error: 'No serial units provided' });

  const result = db.transaction(() => {
    const insertSerial = db.prepare(`INSERT INTO product_serials
      (product_id, imei_1, imei_2, serial_no, status, notes)
      VALUES (?, ?, ?, ?, 'in_stock', ?)`);

    let addedCount = 0;
    for (const u of units) {
      const imei1 = (u.imei_1 || '').trim();
      const imei2 = (u.imei_2 || '').trim();
      const sn = (u.serial_no || '').trim();
      const notes = (u.notes || '').trim();

      if (!imei1 && !sn) {
        throw Object.assign(new Error('Each unit must have at least an IMEI 1 or Serial Number'), { status: 400 });
      }

      // Check duplicate against in-stock units
      if (imei1) {
        const dup = db.prepare(`SELECT id, product_id FROM product_serials WHERE imei_1 = ? AND status = 'in_stock'`).get(imei1);
        if (dup) throw Object.assign(new Error(`IMEI ${imei1} is already registered and in stock`), { status: 400 });
      }
      if (sn) {
        const dup = db.prepare(`SELECT id, product_id FROM product_serials WHERE serial_no = ? AND status = 'in_stock'`).get(sn);
        if (dup) throw Object.assign(new Error(`Serial Number ${sn} is already registered and in stock`), { status: 400 });
      }

      insertSerial.run(prod.id, imei1 || null, imei2 || null, sn || null, notes);
      addedCount++;
    }

    // Automatically update stock movements so derived stock matches serialized count
    db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, user_id, reason)
      VALUES (?, ?, 'adjustment', 'serial_registration', ?, ?)`).run(
        prod.id,
        addedCount,
        req.user.id,
        `Added ${addedCount} serialized unit(s)`
      );

    return { added: addedCount };
  })();

  res.json({ ok: true, ...result });
});

// Update serial status (e.g. mark defective, in_stock)
r.put('/serials/:id/status', requirePermission('stock.manage'), (req, res) => {
  const { status, notes = '' } = req.body || {};
  if (!['in_stock', 'defective', 'returned'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const serial = db.prepare('SELECT * FROM product_serials WHERE id = ?').get(req.params.id);
  if (!serial) return res.status(404).json({ error: 'Serial record not found' });

  const updatedNotes = notes ? (serial.notes ? `${serial.notes} | ${notes}` : notes) : serial.notes;
  db.prepare('UPDATE product_serials SET status = ?, notes = ? WHERE id = ?').run(status, updatedNotes, serial.id);

  res.json({ ok: true });
});

// Global serials list
r.get('/serials', requirePermission('product.view'), (req, res) => {
  const { status = 'all', q, product_id, limit = 100 } = req.query;
  let sql = `SELECT ps.*, p.name AS product_name, p.sku AS product_sku, p.brand, p.model,
      s.invoice_no, s.created_at AS sale_date, c.name AS customer_name, c.phone AS customer_phone
    FROM product_serials ps
    JOIN products p ON p.id = ps.product_id
    LEFT JOIN sales s ON s.id = ps.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE 1=1`;
  const params = [];

  if (status !== 'all') {
    sql += ' AND ps.status = ?';
    params.push(status);
  }
  if (product_id) {
    sql += ' AND ps.product_id = ?';
    params.push(product_id);
  }
  if (q) {
    sql += ' AND (ps.imei_1 LIKE ? OR ps.imei_2 LIKE ? OR ps.serial_no LIKE ? OR p.name LIKE ? OR s.invoice_no LIKE ? OR c.name LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY ps.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// Fast IMEI / Serial & Warranty Lookup (PRD §5, §11.2)
r.get('/serials/lookup', (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) return res.json({ found: false, matches: [] });

  const term = q.trim();
  const sql = `SELECT ps.*, p.name AS product_name, p.sku AS product_sku, p.brand, p.model,
      p.warranty_months, p.image_url,
      s.invoice_no, s.created_at AS sale_date,
      c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
      u.username AS cashier_name
    FROM product_serials ps
    JOIN products p ON p.id = ps.product_id
    LEFT JOIN sales s ON s.id = ps.sale_id
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE ps.imei_1 = ? OR ps.imei_2 = ? OR ps.serial_no = ? OR s.invoice_no = ?
       OR ps.imei_1 LIKE ? OR ps.serial_no LIKE ?
    ORDER BY ps.id DESC LIMIT 10`;

  const rows = db.prepare(sql).all(term, term, term, term, `%${term}%`, `%${term}%`);

  const now = new Date();
  const matches = rows.map(item => {
    let isWarrantyActive = false;
    let daysRemaining = 0;
    if (item.warranty_end_date) {
      const endDate = new Date(item.warranty_end_date);
      const diffTime = endDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isWarrantyActive = daysRemaining >= 0;
    }

    const serviceLogs = db.prepare(`SELECT sl.*, u.username FROM serial_service_logs sl
      JOIN users u ON u.id = sl.user_id
      WHERE sl.serial_id = ? ORDER BY sl.id DESC`).all(item.id);

    return {
      ...item,
      is_warranty_active: isWarrantyActive,
      days_remaining: daysRemaining,
      service_logs: serviceLogs
    };
  });

  res.json({
    found: matches.length > 0,
    matches
  });
});

// Add service / warranty claim log
r.post('/serials/:id/service-logs', requirePermission('sale.view'), (req, res) => {
  const { service_type = 'note', note } = req.body || {};
  if (!note || !note.trim()) return res.status(400).json({ error: 'Service note is required' });

  const serial = db.prepare('SELECT id FROM product_serials WHERE id = ?').get(req.params.id);
  if (!serial) return res.status(404).json({ error: 'Serial unit not found' });

  const info = db.prepare(`INSERT INTO serial_service_logs (serial_id, user_id, service_type, note)
    VALUES (?, ?, ?, ?)`).run(serial.id, req.user.id, service_type, note.trim());

  res.json({ ok: true, id: info.lastInsertRowid });
});

export { r as serialsRouter };
