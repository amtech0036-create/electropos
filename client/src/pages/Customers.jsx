import React, { useEffect, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import { useAuth } from '../App.jsx';
import CustomerLedgerModal from '../components/CustomerLedgerModal.jsx';

export default function Customers() {
  const user = useAuth();
  const [customers, setCustomers] = useState([]);
  const [activeCustId, setActiveCustId] = useState(null);
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

  return (
    <div>
      <div className="page-head">
        <h1>Customers</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="Search name / phone…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(q)}
            style={{ width: '220px', margin: 0 }}
          />
          <button className="btn" onClick={() => load(q)}>Search</button>
          <button className="btn btn-primary" onClick={() => {
            setForm({ name: '', phone: '', address: '' });
            setError('');
            setShowAddModal(true);
          }}>＋ Add customer</button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="num">Purchases</th>
                <th className="num">Paid</th>
                <th className="num">Balance Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '24px' }}>No customers found.</td></tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.is_walkin ? <span className="badge badge-draft" style={{ marginLeft: '6px', fontSize: '0.72rem' }}>Walk-in</span> : null}
                    </td>
                    <td>{c.phone || <span className="muted">—</span>}</td>
                    <td>{c.address || <span className="muted">—</span>}</td>
                    <td className="num">{fmtMoney(c.total_purchases)}</td>
                    <td className="num" style={{ color: '#16a34a' }}>{fmtMoney(c.total_payments)}</td>
                    <td className="num">
                      {c.outstanding_due > 0 ? (
                        <span className="warn" style={{ fontWeight: 700 }}>{fmtMoney(c.outstanding_due)}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-link"
                        onClick={() => setActiveCustId(c.id)}
                        style={{ fontWeight: 600 }}
                      >
                        📜 Ledger
                      </button>
                      {c.outstanding_due > 0 && (user.role === 'admin' || user.role === 'cashier') && (
                        <button
                          className="btn btn-link"
                          style={{ color: '#16a34a', fontWeight: 600, marginLeft: '6px' }}
                          onClick={() => setActiveCustId(c.id)}
                        >
                          💳 Collect Due
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeCustId && (
        <CustomerLedgerModal
          customerId={activeCustId}
          onClose={() => setActiveCustId(null)}
          onPaymentCollected={() => load(q)}
        />
      )}


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
