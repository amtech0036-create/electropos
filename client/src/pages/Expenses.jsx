import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Expenses() {
  const user = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [error, setError] = useState('');

  // New Expense modal state
  const [showModal, setShowModal] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formCategory, setFormCategory] = useState('');
  const [formCustomCat, setFormCustomCat] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState('cash');
  const [formDesc, setFormDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user.role === 'admin';
  const canRecord = user.role === 'admin' || user.role === 'cashier' || user.role === 'stock_manager';

  function calculateDates(p) {
    const now = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (p === 'today') return { from: fmt(now), to: fmt(now) };
    if (p === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    if (p === 'month') {
      return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: fmt(now) };
    }
    return { from: fromDate, to: toDate };
  }

  function load() {
    const { from, to } = calculateDates(period);
    const params = [];
    if (from) params.push(`from=${from}`);
    if (to) params.push(`to=${to}`);
    if (categoryFilter) params.push(`category=${encodeURIComponent(categoryFilter)}`);
    if (paymentFilter) params.push(`payment_method=${encodeURIComponent(paymentFilter)}`);

    const qStr = params.length ? `?${params.join('&')}` : '';

    api.get(`/api/expenses${qStr}`)
      .then(setExpenses)
      .catch(e => setError(e.message));

    const sumParams = [];
    if (from && to) sumParams.push(`from=${from}&to=${to}`);
    api.get(`/api/expenses/summary${sumParams.length ? `?${sumParams.join('&')}` : ''}`)
      .then(setSummary)
      .catch(() => {});
  }

  useEffect(() => {
    load();
    api.get('/api/expenses/categories').then(setCategories).catch(() => {});
  }, [period, categoryFilter, paymentFilter]);

  async function handleSaveExpense(e) {
    e.preventDefault();
    const cat = formCategory === '__custom__' ? formCustomCat.trim() : formCategory;
    if (!cat) return setError('Please select or specify a category');
    const amt = parseFloat(formAmount);
    if (!amt || amt <= 0) return setError('Amount must be positive');

    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/expenses', {
        date: formDate,
        category: cat,
        amount: amt,
        payment_method: formMethod,
        description: formDesc
      });
      setShowModal(false);
      resetForm();
      load();
      api.get('/api/expenses/categories').then(setCategories).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormCategory('');
    setFormCustomCat('');
    setFormAmount('');
    setFormMethod('cash');
    setFormDesc('');
  }

  async function handleDeleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
      await api.del(`/api/expenses/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const topCategory = summary?.by_category?.[0];

  return (
    <div>
      <div className="page-head">
        <h1>Expenses</h1>

        <div className="period-tabs">
          <button className={period === 'today' ? 'active' : ''} onClick={() => setPeriod('today')}>Today</button>
          <button className={period === 'yesterday' ? 'active' : ''} onClick={() => setPeriod('yesterday')}>Yesterday</button>
          <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>This Month</button>
          <button className={period === 'all' ? 'active' : ''} onClick={() => setPeriod('all')}>All</button>
        </div>

        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ width: '180px' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          style={{ width: '130px' }}
        >
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank</option>
          <option value="card">Card</option>
          <option value="bkash">bKash</option>
          <option value="nagad">Nagad</option>
        </select>

        {canRecord && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            ＋ Record Expense
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Expenses</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{fmtMoney(summary?.total ?? 0)}</div>
          <div className="muted"><small>{summary?.count ?? 0} expense transactions</small></div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Top Expense Category</div>
          <div className="stat-value" style={{ fontSize: '1.25rem' }}>
            {topCategory ? topCategory.category : '—'}
          </div>
          <div className="muted">
            <small>{topCategory ? `${fmtMoney(topCategory.amount)} (${topCategory.percent}%)` : 'No data'}</small>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Active Period Filter</div>
          <div className="stat-value" style={{ fontSize: '1.15rem', textTransform: 'capitalize' }}>
            {period === 'month' ? 'Current Month' : period}
          </div>
          <div className="muted"><small>{expenses.length} records shown</small></div>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: '16px', gridTemplateColumns: '1.6fr 1fr' }}>
        {/* Expenses List */}
        <div className="card">
          <h3>Expense Log</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Method</th>
                <th className="num">Amount</th>
                <th>By</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id}>
                  <td className="muted">{exp.date}</td>
                  <td>
                    <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                      {exp.category}
                    </span>
                  </td>
                  <td>{exp.description || '—'}</td>
                  <td>
                    <span style={{ textTransform: 'capitalize' }}>{exp.payment_method}</span>
                  </td>
                  <td className="num font-bold" style={{ color: '#dc2626' }}>
                    {fmtMoney(exp.amount)}
                  </td>
                  <td className="muted"><small>{exp.username || 'System'}</small></td>
                  {canManage && (
                    <td>
                      <button
                        className="btn btn-link danger"
                        onClick={() => handleDeleteExpense(exp.id)}
                        title="Delete expense"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="muted" style={{ textAlign: 'center', padding: '24px' }}>
                    No expenses recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3>Category Breakdown</h3>
          {summary?.by_category?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
              {summary.by_category.map(c => (
                <div key={c.category}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                    <strong>{c.category}</strong>
                    <span>{fmtMoney(c.amount)} ({c.percent}%)</span>
                  </div>
                  <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, c.percent)}%`, height: '100%', background: '#dc2626', borderRadius: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: '24px' }}>
              No category expense breakdown available.
            </div>
          )}
        </div>
      </div>

      {/* RECORD EXPENSE MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Record Shop Expense</h2>
              <button className="btn-link" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveExpense}>
              <label>
                Date *
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </label>

              <label>
                Category *
                <select
                  required
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                >
                  <option value="">Select Category…</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">＋ New / Other Category…</option>
                </select>
              </label>

              {formCategory === '__custom__' && (
                <label>
                  Custom Category Name *
                  <input
                    required
                    placeholder="e.g. Courier charges, Tea & snacks…"
                    value={formCustomCat}
                    onChange={e => setFormCustomCat(e.target.value)}
                  />
                </label>
              )}

              <label>
                Amount (৳) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                />
              </label>

              <label>
                Payment Method *
                <select
                  value={formMethod}
                  onChange={e => setFormMethod(e.target.value)}
                >
                  <option value="cash">Cash (from drawer)</option>
                  <option value="bank">Bank / Card</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                </select>
              </label>

              <label>
                Description / Details
                <textarea
                  rows="2"
                  placeholder="e.g. October electricity bill, shop tea bill, printer paper…"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
