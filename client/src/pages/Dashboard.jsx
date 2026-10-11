import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, fmtDate } from '../api.js';

const PERIODS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['month', 'This Month']];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('today');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/dashboard?period=${period}`).then(setData).catch(e => setError(e.message));
  }, [period]);

  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="period-tabs">
          {PERIODS.map(([k, label]) => (
            <button key={k} className={period === k ? 'active' : ''} onClick={() => setPeriod(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/pos" className="btn btn-primary">＋ New Sale</Link>
        <Link to="/products" className="btn">Add Product</Link>
        <Link to="/sales" className="btn">Sales History</Link>
      </div>

      <p className="muted">Period: {data.period.from} to {data.period.to}</p>

      <div className="cards">
        <div className="card stat">
          <div className="stat-label">Sales (revenue)</div>
          <div className="stat-value">{fmtMoney(data.sales_total)}</div>
          <div className="muted">{data.sales_count} transactions</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Cash collected</div>
          <div className="stat-value">{fmtMoney(data.cash_collected)}</div>
          <div className="muted">actual money received</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Est. gross profit</div>
          <div className="stat-value">{fmtMoney(data.estimated_gross_profit)}</div>
          <div className="muted">before expenses</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Customer due outstanding</div>
          <div className="stat-value warn">{fmtMoney(data.customer_due_total)}</div>
          <div className="muted">not yet collected</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Active products</div>
          <div className="stat-value">{data.active_products}</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Discounts</div>
          <div className="stat-value">{fmtMoney(data.discounts)}</div>
        </div>
      </div>

      {data.payments_by_method.length > 0 && (
        <div className="card">
          <h3>Payments by method</h3>
          <table>
            <tbody>
              {data.payments_by_method.map(m => (
                <tr key={m.method}><td>{m.method}</td><td className="num">{fmtMoney(m.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="two-col">
        {data.low_stock.length > 0 && (
          <div className="card">
            <h3>⚠ Low stock</h3>
            <table>
              <thead><tr><th>Product</th><th>SKU</th><th className="num">Stock</th></tr></thead>
              <tbody>
                {data.low_stock.map(p => (
                  <tr key={p.id}><td>{p.name}</td><td>{p.sku}</td><td className="num">{p.stock}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data.best_sellers.length > 0 && (
          <div className="card">
            <h3>Best sellers</h3>
            <table>
              <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Gross</th></tr></thead>
              <tbody>
                {data.best_sellers.map((p, i) => (
                  <tr key={i}><td>{p.product_name}</td><td className="num">{p.qty_sold}</td><td className="num">{fmtMoney(p.gross)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card">
          <h3>Recent sales</h3>
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th className="num">Total</th><th className="num">Due</th><th>Time</th></tr></thead>
            <tbody>
              {data.recent_sales.map(s => (
                <tr key={s.id}>
                  <td><Link to={`/sales/${s.id}`}>{s.invoice_no}</Link></td>
                  <td>{s.customer_name}{s.customer_phone ? ` ${s.customer_phone}` : ''}</td>
                  <td className="num">{fmtMoney(s.total)}</td>
                  <td className="num">{s.due > 0 ? <span className="warn">{fmtMoney(s.due)}</span> : '—'}</td>
                  <td className="muted">{fmtDate(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
