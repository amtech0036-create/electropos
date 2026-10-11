import { Router } from 'express';
import { db, toMinor, fromMinor } from '../db.js';
import { requireAuth, requirePermission } from '../auth.js';

const r = Router();
r.use(requireAuth);

function dayRange(from, to, period = 'today') {
  if (from && to) return { from, to };
  // Use local date (shop timezone), not UTC — avoids off-by-one around midnight
  const fmt = (d) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const now = new Date();
  if (period === 'yesterday') { const d = new Date(now); d.setDate(d.getDate() - 1); return { from: fmt(d), to: fmt(d) }; }
  if (period === 'month') return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: fmt(now) };
  return { from: fmt(now), to: fmt(now) };
}

// Dashboard (PRD §3): all figures shown separately, never combined
r.get('/dashboard', (req, res) => {
  const { from, to } = dayRange(req.query.from, req.query.to, req.query.period || 'today');
  const dateFilter = 'date(created_at) BETWEEN ? AND ?';

  const salesRow = db.prepare(`SELECT
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*) AS txn_count,
      COALESCE(SUM(item_discount_total + invoice_discount), 0) AS discounts
    FROM sales WHERE status='completed' AND ${dateFilter}`).get(from, to);
  const collectedRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS collected
    FROM payments WHERE kind='sale' AND ${dateFilter}`).get(from, to);
  const profitRow = db.prepare(`SELECT COALESCE(SUM((si.unit_price - si.unit_cost) * si.qty - si.discount), 0) AS gross
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status='completed' AND ${dateFilter}`).get(from, to);
  const byMethod = db.prepare(`SELECT method, COALESCE(SUM(amount),0) AS amount
    FROM payments WHERE kind='sale' AND ${dateFilter} GROUP BY method`).all(from, to);
  // Outstanding due = per-customer (purchases - ALL payments incl. collections) — PRD §3, §8
  const customerDue = db.prepare(`SELECT COALESCE(SUM(balance), 0) AS due FROM (
    SELECT COALESCE((SELECT SUM(total) FROM sales s WHERE s.customer_id = c.id AND s.status='completed'), 0)
         - COALESCE((SELECT SUM(amount) FROM payments p WHERE p.customer_id = c.id), 0) AS balance
    FROM customers c
  ) WHERE balance > 0`).get();
  const supplierDue = db.prepare(`SELECT COALESCE(SUM(balance), 0) AS due FROM (
    SELECT s.opening_balance
         + COALESCE((SELECT SUM(total) FROM purchases p WHERE p.supplier_id = s.id AND p.status='finalized'), 0)
         - COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) AS balance
    FROM suppliers s
  ) WHERE balance > 0`).get();
  const lowStock = db.prepare(`SELECT p.id, p.name, p.sku, p.min_stock_alert,
      COALESCE((SELECT SUM(qty) FROM stock_movements WHERE product_id = p.id), 0) AS stock
    FROM products p WHERE p.active = 1 AND p.min_stock_alert > 0
      AND stock <= p.min_stock_alert ORDER BY stock ASC LIMIT 20`).all();
  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').get().n;
  const recentSales = db.prepare(`SELECT s.id, s.invoice_no, s.total, s.due, s.created_at, c.name AS customer_name, c.phone AS customer_phone
    FROM sales s JOIN customers c ON c.id = s.customer_id
    WHERE s.status='completed' ORDER BY s.id DESC LIMIT 8`).all().map(s => ({ ...s, total: fromMinor(s.total), due: fromMinor(s.due) }));
  const bestSellers = db.prepare(`SELECT si.product_name, SUM(si.qty) AS qty_sold,
      COALESCE(SUM((si.unit_price - si.unit_cost) * si.qty - si.discount), 0) AS gross
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status='completed' AND ${dateFilter}
    GROUP BY si.product_id ORDER BY qty_sold DESC LIMIT 5`).all(from, to)
    .map(p => ({ ...p, gross: fromMinor(p.gross) }));

  res.json({
    period: { from, to },
    sales_total: fromMinor(salesRow.revenue),
    sales_count: salesRow.txn_count,
    estimated_gross_profit: fromMinor(profitRow.gross),
    discounts: fromMinor(salesRow.discounts),
    cash_collected: fromMinor(collectedRow.collected),
    payments_by_method: byMethod.map(m => ({ method: m.method, amount: fromMinor(m.amount) })),
    active_products: productCount,
    low_stock: lowStock,
    customer_due_total: fromMinor(customerDue.due),
    supplier_due_total: fromMinor(supplierDue.due),
    recent_sales: recentSales,
    best_sellers: bestSellers
  });
});

// Daily sales report (PRD §13)
r.get('/reports/daily-sales', requirePermission('report.view'), (req, res) => {
  const { from, to } = dayRange(req.query.from, req.query.to, req.query.period || 'today');
  const rows = db.prepare(`SELECT date(created_at) AS day,
      COALESCE(SUM(total), 0) AS revenue,
      COUNT(*) AS transactions,
      COALESCE(SUM(item_discount_total + invoice_discount), 0) AS discounts,
      COALESCE(SUM(tax_amount), 0) AS tax
    FROM sales WHERE status='completed' AND date(created_at) BETWEEN ? AND ?
    GROUP BY day ORDER BY day DESC`).all(from, to).map(x => ({
      ...x, revenue: fromMinor(x.revenue), discounts: fromMinor(x.discounts), tax: fromMinor(x.tax)
    }));
  res.json({ period: { from, to }, days: rows });
});

// Gross profit report
r.get('/reports/gross-profit', requirePermission('report.profit'), (req, res) => {
  const { from, to } = dayRange(req.query.from, req.query.to, req.query.period || 'today');
  const netSales = db.prepare(`SELECT COALESCE(SUM(total), 0) AS v FROM sales
    WHERE status='completed' AND date(created_at) BETWEEN ? AND ?`).get(from, to).v;
  const cogs = db.prepare(`SELECT COALESCE(SUM(si.unit_cost * si.qty), 0) AS v
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE s.status='completed' AND date(s.created_at) BETWEEN ? AND ?`).get(from, to).v;
  const expenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM expenses
    WHERE date(date) BETWEEN ? AND ?`).get(from, to).v;
  res.json({
    period: { from, to },
    net_sales: fromMinor(netSales),
    cogs: fromMinor(cogs),
    gross_profit: fromMinor(netSales - cogs),
    operating_expenses: fromMinor(expenses),
    estimated_operating_profit: fromMinor(netSales - cogs - expenses)
  });
});

// Payment summary (PRD §13)
r.get('/reports/payments', requirePermission('report.view'), (req, res) => {
  const { from, to } = dayRange(req.query.from, req.query.to, req.query.period || 'today');
  const rows = db.prepare(`SELECT method, kind, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count
    FROM payments WHERE date(created_at) BETWEEN ? AND ?
    GROUP BY method, kind ORDER BY method`).all(from, to)
    .map(x => ({ ...x, amount: fromMinor(x.amount) }));
  res.json({ period: { from, to }, rows });
});

// Customer due report (PRD §13)
r.get('/reports/customer-due', requirePermission('report.view'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM (
      SELECT c.id, c.name, c.phone,
        COALESCE((SELECT SUM(total) FROM sales s WHERE s.customer_id = c.id AND s.status='completed'), 0) AS purchases,
        COALESCE((SELECT SUM(amount) FROM payments p WHERE p.customer_id = c.id), 0) AS payments
      FROM customers c
    ) WHERE purchases - payments > 0
    ORDER BY (purchases - payments) DESC`).all()
    .map(x => ({ ...x, due: fromMinor(x.purchases - x.payments), purchases: fromMinor(x.purchases), payments: fromMinor(x.payments) }));
  res.json(rows);
});

// Stock report (PRD §13)
r.get('/reports/stock', requirePermission('report.view'), (req, res) => {
  const rows = db.prepare(`SELECT p.id, p.name, p.sku, p.purchase_cost, p.min_stock_alert,
      COALESCE((SELECT SUM(qty) FROM stock_movements WHERE product_id = p.id), 0) AS stock
    FROM products p WHERE p.active = 1 ORDER BY p.name`).all()
    .map(p => ({
      ...p, purchase_cost: fromMinor(p.purchase_cost),
      stock_value: fromMinor(p.purchase_cost * p.stock)
    }));
  res.json(rows);
});

// Supplier due report (PRD §13)
r.get('/reports/supplier-due', requirePermission('report.view'), (req, res) => {
  const rows = db.prepare(`SELECT * FROM (
      SELECT s.id, s.name, s.company_name, s.phone,
        s.opening_balance,
        COALESCE((SELECT SUM(total) FROM purchases p WHERE p.supplier_id = s.id AND p.status='finalized'), 0) AS purchases,
        COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) AS payments,
        (s.opening_balance
         + COALESCE((SELECT SUM(total) FROM purchases p WHERE p.supplier_id = s.id AND p.status='finalized'), 0)
         - COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0)) AS balance
      FROM suppliers s
    ) WHERE balance > 0
    ORDER BY balance DESC`).all()
    .map(x => ({
      ...x,
      opening_balance: fromMinor(x.opening_balance),
      purchases: fromMinor(x.purchases),
      payments: fromMinor(x.payments),
      due: fromMinor(x.balance)
    }));
  res.json(rows);
});

// Expense report (PRD §13)
r.get('/reports/expenses', requirePermission('report.view'), (req, res) => {
  const { from, to } = dayRange(req.query.from, req.query.to, req.query.period || 'today');
  const rows = db.prepare(`SELECT e.category,
      COALESCE(SUM(e.amount), 0) AS total,
      COUNT(*) AS count
    FROM expenses e
    WHERE date(e.date) BETWEEN ? AND ?
    GROUP BY e.category ORDER BY total DESC`).all(from, to).map(x => ({
      ...x,
      total: fromMinor(x.total)
    }));
  const overall = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM expenses
    WHERE date(date) BETWEEN ? AND ?`).get(from, to).v;
  res.json({ period: { from, to }, total: fromMinor(overall), categories: rows });
});

export { r as reportsRouter };
