import React, { useEffect, useState, useRef } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

const EMPTY_SUPPLIER = {
  name: '',
  company_name: '',
  phone: '',
  address: '',
  opening_balance: '',
  notes: ''
};

export default function Suppliers() {
  const user = useAuth();
  const ledgerRef = useRef(null);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [showPayModal, setShowPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = user.role === 'admin' || user.role === 'stock_manager';

  function load() {
    api.get(`/api/suppliers${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(setSuppliers)
      .catch(e => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function openSupplierLedger(s) {
    if (selectedSupplier?.id === s.id) {
      setSelectedSupplier(null);
      return;
    }
    try {
      const full = await api.get(`/api/suppliers/${s.id}`);
      setSelectedSupplier(full);
      setTimeout(() => {
        ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSaveSupplier(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Supplier name is required');
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/suppliers', {
        name: form.name.trim(),
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        opening_balance: parseFloat(form.opening_balance) || 0,
        notes: form.notes.trim()
      });
      setShowAddModal(false);
      setForm(EMPTY_SUPPLIER);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return setError('Payment amount must be greater than zero');
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/api/suppliers/${showPayModal.id}/payments`, {
        amount: amt,
        method: payMethod,
        notes: payNotes.trim()
      });
      setShowPayModal(null);
      setPayAmount('');
      setPayNotes('');
      load();
      if (selectedSupplier?.id === showPayModal.id) {
        openSupplierLedger(showPayModal);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalOutstanding = suppliers.reduce((sum, s) => sum + Math.max(0, s.outstanding_balance), 0);
  const totalPurchasesVal = suppliers.reduce((sum, s) => sum + s.total_purchases, 0);
  const totalPaymentsVal = suppliers.reduce((sum, s) => sum + s.total_payments, 0);

  return (
    <div>
      <div className="page-head">
        <h1>Suppliers</h1>
        <input
          placeholder="Search supplier name / company / phone…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <button className="btn" onClick={load}>Search</button>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_SUPPLIER); setShowAddModal(true); }}>
            ＋ Add Supplier
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Suppliers</div>
          <div className="stat-value">{suppliers.length}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Purchases</div>
          <div className="stat-value">{fmtMoney(totalPurchasesVal)}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Paid</div>
          <div className="stat-value" style={{ color: '#10b981' }}>{fmtMoney(totalPaymentsVal)}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Payable Due</div>
          <div className="stat-value" style={{ color: totalOutstanding > 0 ? '#ef4444' : 'inherit' }}>
            {fmtMoney(totalOutstanding)}
          </div>
        </div>
      </div>

      {/* Full-width Suppliers Table */}
      <div className="card" style={{ marginTop: '20px', padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Supplier Directory</h3>
          <span className="muted" style={{ fontSize: '0.82rem' }}>{suppliers.length} suppliers registered</span>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: '20px' }}>Supplier / Company</th>
                <th>Phone</th>
                <th className="num">Purchases</th>
                <th className="num">Paid</th>
                <th className="num">Balance Due</th>
                <th style={{ textAlign: 'center', paddingRight: '20px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => {
                const isSelected = selectedSupplier?.id === s.id;
                return (
                  <tr key={s.id} style={{ background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'inherit' }}>
                    <td style={{ paddingLeft: '20px' }}>
                      <strong style={{ display: 'block', color: 'var(--text)' }}>{s.name}</strong>
                      {s.company_name && <div className="muted"><small>{s.company_name}</small></div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{s.phone || '—'}</td>
                    <td className="num">{fmtMoney(s.total_purchases)}</td>
                    <td className="num">{fmtMoney(s.total_payments)}</td>
                    <td className="num">
                      {s.outstanding_balance > 0 ? (
                        <span className="warn font-bold">{fmtMoney(s.outstanding_balance)}</span>
                      ) : s.outstanding_balance < 0 ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Advance ({fmtMoney(Math.abs(s.outstanding_balance))})</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ textAlign: 'center', paddingRight: '20px', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-link" onClick={() => openSupplierLedger(s)}>
                        {isSelected ? '✕ Hide Ledger' : 'Ledger'}
                      </button>
                      {canManage && (
                        <button
                          className="btn btn-link"
                          style={{ color: '#10b981', fontWeight: 600 }}
                          onClick={() => { setShowPayModal(s); setPayAmount(s.outstanding_balance > 0 ? s.outstanding_balance : ''); }}
                        >
                          Pay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '32px' }}>No suppliers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Supplier Detailed Ledger */}
      {selectedSupplier && (
        <div ref={ledgerRef} className="card" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0 }}>{selectedSupplier.name}</h2>
                <span className="badge badge-finalized">Active Supplier</span>
              </div>
              <div className="muted" style={{ marginTop: '4px' }}>
                {selectedSupplier.company_name && <span>{selectedSupplier.company_name} · </span>}
                {selectedSupplier.phone && <span>📞 {selectedSupplier.phone} · </span>}
                {selectedSupplier.address && <span>📍 {selectedSupplier.address}</span>}
              </div>
            </div>
            <div className="btn-row">
              {canManage && (
                <button
                  className="btn btn-primary"
                  onClick={() => { setShowPayModal(selectedSupplier); setPayAmount(selectedSupplier.outstanding_balance > 0 ? selectedSupplier.outstanding_balance : ''); }}
                >
                  Pay Supplier
                </button>
              )}
              <button className="btn" onClick={() => setSelectedSupplier(null)}>
                ✕ Close Ledger
              </button>
            </div>
          </div>

          <div className="cards" style={{ margin: '18px 0' }}>
            <div className="card" style={{ marginBottom: 0, padding: '16px' }}>
              <div className="stat-label">Total Purchases</div>
              <div className="stat-value" style={{ fontSize: '1.3rem' }}>{fmtMoney(selectedSupplier.total_purchases)}</div>
            </div>
            <div className="card" style={{ marginBottom: 0, padding: '16px' }}>
              <div className="stat-label">Total Paid</div>
              <div className="stat-value" style={{ color: '#10b981', fontSize: '1.3rem' }}>{fmtMoney(selectedSupplier.total_payments)}</div>
            </div>
            <div className="card" style={{ marginBottom: 0, padding: '16px' }}>
              <div className="stat-label">Outstanding Payable</div>
              <div className="stat-value" style={{ color: selectedSupplier.outstanding_balance > 0 ? '#ef4444' : 'inherit', fontSize: '1.3rem' }}>
                {fmtMoney(selectedSupplier.outstanding_balance)}
              </div>
            </div>
          </div>

          <h3>Statement Ledger</h3>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
            <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference / Transaction</th>
                    <th className="num">Debit (Paid)</th>
                    <th className="num">Credit (Bill)</th>
                    <th className="num">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplier.ledger.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}><small>{fmtDate(entry.date)}</small></td>
                      <td>
                        <strong>{entry.reference}</strong>
                        {entry.notes && <div className="muted"><small>{entry.notes}</small></div>}
                      </td>
                      <td className="num" style={{ color: entry.debit > 0 ? '#10b981' : 'inherit' }}>
                        {entry.debit > 0 ? fmtMoney(entry.debit) : '—'}
                      </td>
                      <td className="num" style={{ color: entry.credit > 0 ? '#ef4444' : 'inherit' }}>
                        {entry.credit > 0 ? fmtMoney(entry.credit) : '—'}
                      </td>
                      <td className="num font-bold">
                        {fmtMoney(entry.balance)}
                      </td>
                    </tr>
                  ))}
                  {selectedSupplier.ledger.length === 0 && (
                    <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: '20px' }}>No ledger entries.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <h3>Recent Purchase Invoices</h3>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Date</th>
                    <th className="num">Total</th>
                    <th className="num">Due</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSupplier.purchases.slice(0, 5).map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.purchase_no}</strong></td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{p.purchase_date}</td>
                      <td className="num">{fmtMoney(p.total)}</td>
                      <td className="num">{p.due > 0 ? fmtMoney(p.due) : '—'}</td>
                      <td style={{ textAlign: 'center' }}><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                    </tr>
                  ))}
                  {selectedSupplier.purchases.length === 0 && (
                    <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: '16px' }}>No purchase invoices.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Add New Supplier</h2>
              <button className="btn-link" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveSupplier}>
              <label>
                Supplier / Contact Name *
                <input
                  required
                  placeholder="e.g. Karim Ahmed"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label>
                Company / Shop Name
                <input
                  placeholder="e.g. Star Tech Wholesale Ltd."
                  value={form.company_name}
                  onChange={e => setForm({ ...form, company_name: e.target.value })}
                />
              </label>

              <label>
                Phone Number
                <input
                  placeholder="e.g. +8801700000000"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label>
                Address
                <input
                  placeholder="e.g. Multiplan Center, Level 4, Dhaka"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </label>

              <label>
                Opening Balance Due (৳)
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.opening_balance}
                  onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                />
              </label>

              <label>
                Notes
                <textarea
                  rows="2"
                  placeholder="Payment terms, bank details, contact person…"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {showPayModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Record Payment to Supplier</h2>
              <button className="btn-link" onClick={() => setShowPayModal(null)}>✕</button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <p>
                Paying: <strong>{showPayModal.name}</strong>
                {showPayModal.outstanding_balance > 0 && (
                  <span className="muted"> (Current Due: {fmtMoney(showPayModal.outstanding_balance)})</span>
                )}
              </p>

              <label>
                Amount (৳) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </label>

              <label>
                Payment Method *
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank / Card</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                </select>
              </label>

              <label>
                Notes / Reference
                <input
                  placeholder="e.g. Cheque #49281, bKash TrxID..."
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowPayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Confirm Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
