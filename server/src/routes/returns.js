import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

function nextReturnNo() {
  const year = new Date().getFullYear();
  const prefix = (db.prepare("SELECT value FROM settings WHERE key='return_prefix'").get()?.value) || 'RET-';
  const row = db.transaction(() => {
    db.prepare(`INSERT INTO return_counters (year, seq) VALUES (?, 1)
                ON CONFLICT(year) DO UPDATE SET seq = seq + 1`).run(year);
    return db.prepare('SELECT seq FROM return_counters WHERE year = ?').get(year);
  })();
  return `${prefix}${year}-${String(row.seq).padStart(5, '0')}`;
}

// Get return eligibility for a sale's items
r.get('/sales/:id/return-eligibility', requirePermission('sale.view'), (req, res) => {
  const sale = db.prepare(`SELECT s.*, c.name AS customer_name FROM sales s
    JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  if (sale.status === 'cancelled') return res.status(400).json({ error: 'Cannot return items from a cancelled sale' });

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  const eligibleItems = items.map(item => {
    const returned = db.prepare(`SELECT COALESCE(SUM(qty), 0) AS total FROM sale_return_items WHERE sale_item_id = ?`).get(item.id).total;
    const remaining = Math.max(0, item.qty - returned);
    const unitPriceEffective = item.qty > 0 ? Math.round(item.line_total / item.qty) : item.unit_price;
    return {
      ...item,
      unit_price: fromMinor(item.unit_price),
      discount: fromMinor(item.discount),
      line_total: fromMinor(item.line_total),
      unit_refund_effective: fromMinor(unitPriceEffective),
      already_returned_qty: returned,
      remaining_qty: remaining,
      can_return: remaining > 0
    };
  });

  const previousReturns = db.prepare(`SELECT r.*, u.username AS cashier_name FROM sale_returns r
    JOIN users u ON u.id = r.user_id WHERE r.sale_id = ? ORDER BY r.id DESC`).all(sale.id).map(r => ({
      ...r, total_refund: fromMinor(r.total_refund)
    }));

  res.json({
    sale: {
      ...sale,
      total: fromMinor(sale.total),
      paid: fromMinor(sale.paid),
      due: fromMinor(sale.due)
    },
    items: eligibleItems,
    previous_returns: previousReturns
  });
});

// Process a sales return (PRD §11.1)
r.post('/sales/:id/returns', requirePermission('sale.return'), (req, res) => {
  const { items, refund_method = 'cash', reason = '' } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please select at least one item to return' });
  }

  const validMethods = ['cash', 'bkash', 'nagad', 'card', 'credit'];
  if (!validMethods.includes(refund_method)) {
    return res.status(400).json({ error: `Invalid refund method: ${refund_method}` });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  if (sale.status === 'cancelled') return res.status(400).json({ error: 'Cannot return items from a cancelled sale' });

  const result = db.transaction(() => {
    let totalRefund = 0;
    const processedItems = [];

    for (const entry of items) {
      const returnQty = parseInt(entry.qty, 10);
      if (!Number.isInteger(returnQty) || returnQty <= 0) {
        throw Object.assign(new Error('Return quantity must be a positive integer'), { status: 400 });
      }

      const saleItem = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(entry.sale_item_id, sale.id);
      if (!saleItem) {
        throw Object.assign(new Error(`Item ${entry.sale_item_id} does not belong to this sale`), { status: 400 });
      }

      const alreadyReturned = db.prepare('SELECT COALESCE(SUM(qty), 0) AS total FROM sale_return_items WHERE sale_item_id = ?').get(saleItem.id).total;
      const remainingQty = saleItem.qty - alreadyReturned;

      if (returnQty > remainingQty) {
        throw Object.assign(new Error(`Cannot return ${returnQty} of ${saleItem.product_name} (only ${remainingQty} eligible)`), { status: 400 });
      }

      const condition = ['restockable', 'damaged', 'repair'].includes(entry.condition) ? entry.condition : 'restockable';
      // Calculate proportionate refund based on line_total (which accounts for item discounts)
      const lineRefund = Math.round((saleItem.line_total / saleItem.qty) * returnQty);
      totalRefund += lineRefund;

      processedItems.push({
        sale_item: saleItem,
        qty: returnQty,
        condition,
        unit_price: saleItem.unit_price,
        line_refund: lineRefund
      });
    }

    const returnNo = nextReturnNo();
    const info = db.prepare(`INSERT INTO sale_returns (return_no, sale_id, customer_id, user_id, total_refund, refund_method, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(returnNo, sale.id, sale.customer_id, req.user.id, totalRefund, refund_method, reason);
    const returnId = info.lastInsertRowid;

    for (const p of processedItems) {
      db.prepare(`INSERT INTO sale_return_items (return_id, sale_item_id, product_id, qty, unit_price, refund_amount, condition)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(returnId, p.sale_item.id, p.sale_item.product_id, p.qty, p.unit_price, p.line_refund, p.condition);

      // If condition is restockable, restore to available inventory (PRD §11.1)
      if (p.condition === 'restockable') {
        db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, source_id, reason, user_id)
          VALUES (?, ?, 'return', 'sale_return', ?, ?, ?)`).run(
            p.sale_item.product_id,
            p.qty,
            returnId,
            `Return ${returnNo}: ${reason || 'Customer return'}`,
            req.user.id
          );
      } else {
        // Damaged or repair: record movement with 0 qty for audit log
        db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, source_id, reason, user_id)
          VALUES (?, 0, 'return', 'sale_return', ?, ?, ?)`).run(
            p.sale_item.product_id,
            returnId,
            `Return ${returnNo} (${p.condition}): ${reason || 'Non-restockable item'}`,
            req.user.id
          );
      }
    }

    // Financial adjustment (PRD §11.1, §19.6):
    if (refund_method === 'credit') {
      // Customer credit: if sale had due, reduce it; otherwise reduce total or register negative payment
      if (sale.due >= totalRefund) {
        db.prepare('UPDATE sales SET due = due - ? WHERE id = ?').run(totalRefund, sale.id);
      } else {
        const remainingRefund = totalRefund - sale.due;
        db.prepare('UPDATE sales SET due = 0 WHERE id = ?').run(sale.id);
        // Record credit balance reduction on customer ledger
        db.prepare(`INSERT INTO payments (sale_id, customer_id, method, amount, kind, user_id)
          VALUES (?, ?, 'cash', ?, 'sale', ?)`).run(sale.id, sale.customer_id, -remainingRefund, req.user.id);
      }
    } else {
      // Direct refund via cash/digital: insert negative payment record
      // This automatically reduces cash in register and appears in payment/cashbook summaries
      db.prepare(`INSERT INTO payments (sale_id, customer_id, method, amount, kind, user_id)
        VALUES (?, ?, ?, ?, 'sale', ?)`).run(sale.id, sale.customer_id, refund_method, -totalRefund, req.user.id);
    }

    return {
      return_id: returnId,
      return_no: returnNo,
      total_refund: fromMinor(totalRefund)
    };
  })();

  res.json({ ok: true, ...result });
});

// List all sales returns across store
r.get('/returns', requirePermission('sale.view'), (req, res) => {
  const { q, limit = 100 } = req.query;
  let sql = `SELECT r.*, s.invoice_no, c.name AS customer_name, c.phone AS customer_phone, u.username AS cashier_name,
      (SELECT COUNT(*) FROM sale_return_items ri WHERE ri.return_id = r.id) AS item_count
    FROM sale_returns r
    JOIN sales s ON s.id = r.sale_id
    JOIN customers c ON c.id = r.customer_id
    JOIN users u ON u.id = r.user_id
    WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (r.return_no LIKE ? OR s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY r.id DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 100);

  const rows = db.prepare(sql).all(...params).map(r => ({
    ...r, total_refund: fromMinor(r.total_refund)
  }));
  res.json(rows);
});

// View a specific return with its items
r.get('/returns/:id', requirePermission('sale.view'), (req, res) => {
  const ret = db.prepare(`SELECT r.*, s.invoice_no, c.name AS customer_name, c.phone AS customer_phone, u.username AS cashier_name
    FROM sale_returns r
    JOIN sales s ON s.id = r.sale_id
    JOIN customers c ON c.id = r.customer_id
    JOIN users u ON u.id = r.user_id
    WHERE r.id = ?`).get(req.params.id);
  if (!ret) return res.status(404).json({ error: 'Return record not found' });

  const items = db.prepare(`SELECT ri.*, p.name AS product_name, p.sku AS product_sku
    FROM sale_return_items ri
    JOIN products p ON p.id = ri.product_id
    WHERE ri.return_id = ?`).all(ret.id).map(i => ({
      ...i,
      unit_price: fromMinor(i.unit_price),
      refund_amount: fromMinor(i.refund_amount)
    }));

  res.json({
    ...ret,
    total_refund: fromMinor(ret.total_refund),
    items
  });
});

export { r as returnsRouter };
