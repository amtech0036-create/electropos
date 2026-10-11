import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Customers() {
  const user = useAuth();
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  function load(query = '') {
    api.get(`/api/customers${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setCustomers).catch(e => setError(e.message));
  }
  useEffect(() => { load(); }, []);

  async function open(c) {
    const full = await api.get(`/api/customers/${c.id}`);
    setSelected(full);
  }

  async function handleAddCustomer(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/api/customers', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim()
      });
      setShowAddModal(false);
      setForm({ name: '', phone: '', address: '' });
      load(q);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function collectDue(c) {
    const amt = prompt(`Collect due from ${c.name} (৳):`);
    if (!amt) return;
    try {
      await api.post(`/api/customers/${c.id}/collections`, { amount: parseFloat(amt), method: 'cash' });
      load(q);
      if (selected?.id === c.id) open(c);
    } catch (e) { setError(e.message); }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Customers</h1>
        <input placeholder="Search name / phone…" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(q)} />
        <button className="btn" onClick={() => load(q)}>Search</button>
        <button className="btn btn-primary" onClick={() => {
          setForm({ name: '', phone: '', address: '' });
          setError('');
          setShowAddModal(true);
        }}>＋ Add customer</button>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="two-col">
        <div className="card">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th className="num">Purchases</th><th className="num">Due</th><th></th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td>{c.name}{c.is_walkin ? ' <small>(walk-in)</small>' : ''}</td>
                  <td>{c.phone || '—'}</td>
                  <td className="num">{fmtMoney(c.total_purchases)}</td>
                  <td className="num">{c.outstanding_due > 0 ? <span className="warn">{fmtMoney(c.outstanding_due)}</span> : '—'}</td>
                  <td>
                    <button className="btn btn-link" onClick={() => open(c)}>Ledger</button>
                    {c.outstanding_due > 0 && (user.role === 'admin' || user.role === 'cashier') &&
                      <button className="btn btn-link" onClick={() => collectDue(c)}>Collect due</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="card">
            <h3>{selected.name}{selected.phone ? ` ${selected.phone}` : ''} — ledger</h3>
            <p className="muted">Purchases: {fmtMoney(selected.total_purchases)} · Payments: {fmtMoney(selected.total_payments)} · Due: <strong className="warn">{fmtMoney(selected.outstanding_due)}</strong></p>
            <h4>Invoices</h4>
            <table>
              <thead><tr><th>Invoice</th><th>Date</th><th className="num">Total</th><th className="num">Due</th></tr></thead>
              <tbody>
                {selected.sales.map(s => (
                  <tr key={s.id}><td>{s.invoice_no}</td><td className="muted">{fmtDate(s.created_at)}</td>
                    <td className="num">{fmtMoney(s.total)}</td><td className="num">{s.due > 0 ? fmtMoney(s.due) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
            <h4>Payments</h4>
            <table>
              <tbody>
                {selected.payments.map(p => (
                  <tr key={p.id}><td className="muted">{fmtDate(p.created_at)}</td><td>{p.kind}</td><td>{p.method}</td><td className="num">{fmtMoney(p.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Add New Customer</h2>
              <button type="button" className="btn-link" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddCustomer}>
              <label>
                Customer Name *
                <input
                  required
                  autoFocus
                  placeholder="e.g. Rahim or Rahim 01700000000"
                  value={form.name}
                  onChange={e => {
                    const val = e.target.value;
                    if (!form.phone) {
                      const match = val.match(/^(.*?)\s+([+0-9\-()]{7,20})$/);
                      if (match) {
                        setForm({ ...form, name: match[1], phone: match[2] });
                        return;
                      }
                    }
                    setForm({ ...form, name: val });
                  }}
                />
              </label>
              <label>
                Phone Number
                <input
                  placeholder="e.g. 01700000000"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label>
                Address (Optional)
                <input
                  placeholder="e.g. Mirpur, Dhaka"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </label>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
