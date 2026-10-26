import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate, fmtOrdinalDate } from '../api.js';
import MoneyReceiptModal from './MoneyReceiptModal.jsx';

export default function CustomerLedgerModal({ customerId, onClose, onPaymentCollected }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Payment Collection Form State
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [saleId, setSaleId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'invoices'
  const [lastReceipt, setLastReceipt] = useState(null);

  async function loadCustomer() {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/customers/${customerId}`);
      setData(res);
      // Auto-select invoice with due if any
      const dueSale = (res.sales || []).find(s => s.due > 0);
      if (dueSale && !saleId) {
        setSaleId(dueSale.id);
        if (dueSale.installment_amount) {
          setAmount(dueSale.installment_amount);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load customer statement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  async function handleCollect(e) {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!numAmt || numAmt <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.post(`/api/customers/${customerId}/collections`, {
        amount: numAmt,
        method,
        sale_id: saleId ? parseInt(saleId, 10) : null,
        notes: notes.trim()
      });
      setSuccessMsg(res.message || `✓ Successfully collected ${fmtMoney(numAmt)} via ${method.toUpperCase()}`);
      setAmount('');
      setNotes('');
      if (res.receipt) {
        setLastReceipt(res.receipt);
      }
      await loadCustomer();
      if (onPaymentCollected) onPaymentCollected();
    } catch (err) {
      setError(err.message || 'Failed to record collection');
    } finally {
      setSubmitting(false);
    }
  }

  if (!customerId) return null;


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>📋 Customer Statement Ledger</h2>
            {data && (
              <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '2px' }}>
                <strong>{data.name}</strong> {data.phone ? `· 📞 ${data.phone}` : ''} {data.address ? `· 📍 ${data.address}` : ''}
              </div>
            )}
          </div>
          <button type="button" className="btn-link" onClick={onClose} style={{ fontSize: '1.2rem' }}>✕</button>
        </div>

        {loading && <div style={{ padding: '24px', textAlign: 'center' }}>Loading ledger…</div>}

        {error && <div className="error" style={{ marginBottom: '14px' }}>{error}</div>}
        {successMsg && <div className="badge badge-paid" style={{ display: 'block', padding: '10px 14px', marginBottom: '14px', fontSize: '0.9rem' }}>{successMsg}</div>}

        {data && (
          <div>
            {/* Stat Cards */}
            <div className="ledger-stat-grid">
              <div className="ledger-stat-card">
                <div className="ledger-stat-label">Total Invoiced</div>
                <div className="ledger-stat-val">{fmtMoney(data.total_purchases)}</div>
              </div>
              <div className="ledger-stat-card">
                <div className="ledger-stat-label">Total Paid</div>
                <div className="ledger-stat-val" style={{ color: '#16a34a' }}>{fmtMoney(data.total_payments)}</div>
              </div>
              <div className="ledger-stat-card" style={{ background: data.outstanding_due > 0 ? 'rgba(254, 242, 242, 0.8)' : undefined }}>
                <div className="ledger-stat-label">Outstanding Balance</div>
                <div className={`ledger-stat-val ${data.outstanding_due > 0 ? 'warn' : ''}`}>
                  {fmtMoney(data.outstanding_due)}
                </div>
              </div>
            </div>

            {/* Collection Panel if there is outstanding due */}
            <div className="installment-card" style={{ marginBottom: '20px' }}>
              <div className="installment-title">
                <span>💳 Collect Payment / Installment</span>
                {data.outstanding_due > 0 ? (
                  <span className="badge badge-partial">Due: {fmtMoney(data.outstanding_due)}</span>
                ) : (
                  <span className="badge badge-paid">Fully Cleared</span>
                )}
              </div>

              <form onSubmit={handleCollect} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <label>
                    Amount to Collect (৳) *
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                  </label>

                  <label>
                    Payment Method
                    <select value={method} onChange={e => setMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="card">Card</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </label>

                  <label>
                    Apply to Invoice (Optional)
                    <select value={saleId} onChange={e => {
                      const sid = e.target.value;
                      setSaleId(sid);
                      const s = data.sales.find(x => String(x.id) === sid);
                      if (s) {
                        if (s.installment_amount) setAmount(s.installment_amount);
                        else if (s.due > 0) setAmount(s.due);
                      }
                    }}>
                      <option value="">General Account Credit</option>
                      {(data.sales || []).filter(s => s.due > 0).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.invoice_no} (Due: {fmtMoney(s.due)}{s.installment_amount ? ` · Inst: ${fmtMoney(s.installment_amount)}` : ''})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Quick amount suggestion chips */}
                {data.outstanding_due > 0 && (
                  <div className="pill-group" style={{ margin: '0' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', alignSelf: 'center', marginRight: '4px' }}>Quick:</span>
                    <button
                      type="button"
                      className="pill-btn"
                      onClick={() => setAmount(data.outstanding_due)}
                    >
                      Pay Full Due ({fmtMoney(data.outstanding_due)})
                    </button>
                    {(data.sales || []).filter(s => s.due > 0 && s.installment_amount).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="pill-btn"
                        onClick={() => {
                          setSaleId(s.id);
                          setAmount(s.installment_amount);
                          setNotes(`Installment for ${s.invoice_no}`);
                        }}
                      >
                        1 Installment ({fmtMoney(s.installment_amount)}) — {s.invoice_no}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <label style={{ flex: 1, margin: 0 }}>
                    Note / Reference
                    <input
                      placeholder="e.g. Installment #2, Bank Ref #, or receipt note"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || !amount || parseFloat(amount) <= 0}
                    style={{ whiteSpace: 'nowrap', height: '40px' }}
                  >
                    {submitting ? 'Recording…' : '✓ Record Collection'}
                  </button>
                </div>
              </form>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
              <button
                className={`btn btn-link ${activeTab === 'ledger' ? 'active' : ''}`}
                style={{ fontWeight: activeTab === 'ledger' ? 700 : 500, borderBottom: activeTab === 'ledger' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '8px' }}
                onClick={() => setActiveTab('ledger')}
              >
                📜 Chronological Statement Ledger ({data.ledger?.length || 0})
              </button>
              <button
                className={`btn btn-link ${activeTab === 'invoices' ? 'active' : ''}`}
                style={{ fontWeight: activeTab === 'invoices' ? 700 : 500, borderBottom: activeTab === 'invoices' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '8px' }}
                onClick={() => setActiveTab('invoices')}
              >
                🧾 Invoices & Installment Plans ({data.sales?.length || 0})
              </button>
            </div>

            {/* Tab 1: Full Ledger */}
            {activeTab === 'ledger' && (
              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Description / Notes</th>
                      <th className="num">Debit (+)</th>
                      <th className="num">Credit (−)</th>
                      <th className="num">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.ledger || []).length === 0 ? (
                      <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '16px' }}>No statement transactions recorded yet.</td></tr>
                    ) : (
                      data.ledger.map((row, idx) => (
                        <tr key={idx}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</td>
                          <td>
                            {row.type === 'sale' ? (
                              <span className="ledger-badge-debit">Invoice</span>
                            ) : (
                              <span className="ledger-badge-credit">{row.type === 'collection' ? 'Collection' : 'Payment'}</span>
                            )}
                          </td>
                          <td>
                            <strong>{row.reference}</strong>
                            {row.receipt_no && (
                              <button
                                type="button"
                                className="btn btn-link"
                                style={{ padding: '0 4px', fontSize: '0.75rem', marginLeft: '6px', color: '#4f46e5' }}
                                onClick={() => {
                                  const linkedSale = (data.sales || []).find(s => s.due > 0 && s.installment_amount);
                                  setLastReceipt({
                                    receipt_no: row.receipt_no,
                                    created_at: row.date,
                                    customer_name: data.name,
                                    customer_phone: data.phone,
                                    customer_address: data.address,
                                    cashier_name: 'Cashier',
                                    method: row.method || 'cash',
                                    amount_paid: row.credit,
                                    previous_due: row.balance + row.credit,
                                    new_due: row.balance,
                                    notes: row.notes,
                                    next_installment: row.balance > 0 && linkedSale ? {
                                      date: linkedSale.next_due_date,
                                      amount: linkedSale.installment_amount,
                                      frequency: linkedSale.frequency
                                    } : null,
                                    settings: data.settings || {}
                                  });
                                }}
                              >
                                🧾 Receipt
                              </button>
                            )}
                          </td>
                          <td style={{ fontSize: '0.84rem' }}>{row.notes || '—'}</td>
                          <td className="num" style={{ color: row.debit > 0 ? '#b91c1c' : undefined, fontWeight: row.debit > 0 ? 600 : 400 }}>
                            {row.debit > 0 ? fmtMoney(row.debit) : '—'}
                          </td>
                          <td className="num" style={{ color: row.credit > 0 ? '#15803d' : undefined, fontWeight: row.credit > 0 ? 600 : 400 }}>
                            {row.credit > 0 ? fmtMoney(row.credit) : '—'}
                          </td>
                          <td className="num" style={{ fontWeight: 700, color: row.balance > 0 ? '#dc2626' : '#1e293b' }}>
                            {fmtMoney(row.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab 2: Invoices Breakdown */}
            {activeTab === 'invoices' && (
              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th className="num">Total</th>
                      <th className="num">Paid</th>
                      <th className="num">Due</th>
                      <th>Installment Plan</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.sales || []).length === 0 ? (
                      <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '16px' }}>No invoices found.</td></tr>
                    ) : (
                      data.sales.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.invoice_no}</strong></td>
                          <td className="muted">{fmtDate(s.created_at)}</td>
                          <td className="num">{fmtMoney(s.total)}</td>
                          <td className="num">{fmtMoney(s.paid)}</td>
                          <td className="num">
                            {s.due > 0 ? <strong className="warn">{fmtMoney(s.due)}</strong> : <span style={{ color: '#16a34a' }}>✓ Settled</span>}
                          </td>
                          <td>
                            {s.total_installments > 1 ? (
                              <span className="badge badge-draft" style={{ fontSize: '0.76rem' }}>
                                📅 {s.total_installments}x {fmtMoney(s.installment_amount)} ({s.frequency})
                              </span>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                          <td>
                            {s.due > 0 && (
                              <button
                                type="button"
                                className="btn btn-link"
                                style={{ color: '#16a34a', fontWeight: 600 }}
                                onClick={() => {
                                  setSaleId(s.id);
                                  setAmount(s.installment_amount || s.due);
                                  setNotes(`Payment for ${s.invoice_no}`);
                                }}
                              >
                                Pay Now
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-foot">
              <button type="button" className="btn" onClick={onClose}>Close Statement</button>
            </div>
          </div>
        )}
      </div>

      {lastReceipt && (
        <MoneyReceiptModal
          receipt={lastReceipt}
          onClose={() => setLastReceipt(null)}
        />
      )}
    </div>
  );
}
