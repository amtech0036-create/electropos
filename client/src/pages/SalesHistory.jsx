import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function SalesHistory() {
  const user = useAuth();
  const [tab, setTab] = useState('sales'); // 'sales' | 'returns'
  const [sales, setSales] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  // Return modal state
  const [returnModalSale, setReturnModalSale] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [returnItems, setReturnItems] = useState({}); // sale_item_id -> { qty, condition }
  const [refundMethod, setRefundMethod] = useState('cash');
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Return detail modal state
  const [viewReturnDetail, setViewReturnDetail] = useState(null);

  function loadSales(query = '') {
    api.get(`/api/sales${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setSales).catch(e => setError(e.message));
  }

  function loadReturns(query = '') {
    api.get(`/api/returns${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setReturnsList).catch(e => setError(e.message));
  }

  useEffect(() => {
    if (tab === 'sales') loadSales(q);
    else loadReturns(q);
  }, [tab]);

  async function openReturnModal(sale) {
    try {
      setError('');
      setReturnModalSale(sale);
      const res = await api.get(`/api/sales/${sale.id}/return-eligibility`);
      setEligibility(res);
      // Initialize returnItems with 0 qty for each item
      const initial = {};
      res.items.forEach(item => {
        initial[item.id] = { qty: 0, condition: 'restockable' };
      });
      setReturnItems(initial);
      setRefundMethod('cash');
      setReturnReason('');
    } catch (err) {
      alert(err.message);
      setReturnModalSale(null);
    }
  }

  function handleReturnItemChange(itemId, field, val) {
    setReturnItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: val
      }
    }));
  }

  // Calculate total refund dynamically
  const calculatedRefund = eligibility?.items.reduce((sum, item) => {
    const entry = returnItems[item.id];
    const qty = parseInt(entry?.qty, 10) || 0;
    if (qty <= 0) return sum;
    const lineRefund = Math.round(item.unit_refund_effective * qty);
    return sum + lineRefund;
  }, 0) || 0;

  async function handleReturnSubmit(e) {
    e.preventDefault();
    if (!eligibility) return;

    const payloadItems = [];
    for (const item of eligibility.items) {
      const entry = returnItems[item.id];
      const qty = parseInt(entry?.qty, 10) || 0;
      if (qty > 0) {
        if (qty > item.remaining_qty) {
          alert(`Quantity for ${item.product_name} exceeds remaining eligible quantity (${item.remaining_qty})`);
          return;
        }
        payloadItems.push({
          sale_item_id: item.id,
          qty,
          condition: entry.condition || 'restockable'
        });
      }
    }

    if (payloadItems.length === 0) {
      alert('Please specify at least 1 item quantity to return');
      return;
    }

    setSubmittingReturn(true);
    try {
      const res = await api.post(`/api/sales/${returnModalSale.id}/returns`, {
        items: payloadItems,
        refund_method: refundMethod,
        reason: returnReason
      });
      alert(`Return ${res.return_no} processed successfully! Refund amount: ${fmtMoney(res.total_refund)}`);
      setReturnModalSale(null);
      setEligibility(null);
      loadSales(q);
      if (tab === 'returns') loadReturns(q);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingReturn(false);
    }
  }

  async function openReturnDetails(returnId) {
    try {
      const res = await api.get(`/api/returns/${returnId}`);
      setViewReturnDetail(res);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sales & Returns</h1>
          <div className="muted">Track customer invoices, process item returns, and review refund logs</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className={`btn ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>Sales Invoices</button>
          <button className={`btn ${tab === 'returns' ? 'active' : ''}`} onClick={() => setTab('returns')}>Sales Returns Log</button>
          <input placeholder={tab === 'sales' ? "Search invoice no or customer…" : "Search return no or customer…"}
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'sales' ? loadSales(q) : loadReturns(q))} />
          <button className="btn" onClick={() => (tab === 'sales' ? loadSales(q) : loadReturns(q))}>Search</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Sales Tab */}
      {tab === 'sales' && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th className="num">Total</th>
                <th className="num">Paid</th>
                <th className="num">Due</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.id} className={s.status === 'cancelled' ? 'cancelled' : ''}>
                  <td><strong>{s.invoice_no}</strong></td>
                  <td className="muted">{fmtDate(s.created_at)}</td>
                  <td>{s.customer_name}</td>
                  <td>{s.cashier_name}</td>
                  <td className="num">{fmtMoney(s.total)}</td>
                  <td className="num">{fmtMoney(s.paid)}</td>
                  <td className="num">{s.due > 0 ? <span className="warn">{fmtMoney(s.due)}</span> : '—'}</td>
                  <td>
                    <span className={`badge ${s.status === 'completed' ? 'badge-completed' : 'badge-cancelled'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link to={`/sales/${s.id}`} className="btn btn-link">View / Print</Link>
                      {s.status === 'completed' && (
                        <button className="btn btn-link" style={{ color: '#ea580c' }} onClick={() => openReturnModal(s)}>
                          Return Items
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && <tr><td colSpan="9" className="muted">No sales found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Returns Tab */}
      {tab === 'returns' && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Return No</th>
                <th>Date</th>
                <th>Original Invoice</th>
                <th>Customer</th>
                <th>Cashier</th>
                <th className="num">Total Refund</th>
                <th>Refund Method</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {returnsList.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.return_no}</strong></td>
                  <td className="muted">{fmtDate(r.created_at)}</td>
                  <td><Link to={`/sales/${r.sale_id}`}>{r.invoice_no}</Link></td>
                  <td>{r.customer_name}</td>
                  <td>{r.cashier_name}</td>
                  <td className="num" style={{ color: '#dc2626', fontWeight: 600 }}>
                    {fmtMoney(r.total_refund)}
                  </td>
                  <td><span className="badge badge-draft">{r.refund_method.toUpperCase()}</span></td>
                  <td className="muted" style={{ maxWidth: '220px' }}>{r.reason || '—'}</td>
                  <td>
                    <button className="btn btn-link" onClick={() => openReturnDetails(r.id)}>Details</button>
                  </td>
                </tr>
              ))}
              {returnsList.length === 0 && (
                <tr><td colSpan="9" className="muted">No sales returns recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Process Return */}
      {returnModalSale && eligibility && (
        <div className="modal-overlay" onClick={() => setReturnModalSale(null)}>
          <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Process Sales Return — {eligibility.sale.invoice_no}</h2>
              <button className="btn btn-link" onClick={() => setReturnModalSale(null)}>✕</button>
            </div>
            <form onSubmit={handleReturnSubmit}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customer: <strong>{eligibility.sale.customer_name}</strong></span>
                  <span>Sale Total: <strong>{fmtMoney(eligibility.sale.total)}</strong></span>
                  <span>Outstanding Due: <strong>{fmtMoney(eligibility.sale.due)}</strong></span>
                </div>
              </div>

              <h3>Select Eligible Items to Return (PRD §11.1)</h3>
              <table style={{ marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Sold Qty</th>
                    <th>Already Returned</th>
                    <th>Returnable</th>
                    <th style={{ width: '100px' }}>Return Qty</th>
                    <th style={{ width: '160px' }}>Condition</th>
                    <th className="num">Unit Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibility.items.map(item => {
                    const entry = returnItems[item.id] || { qty: 0, condition: 'restockable' };
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.product_name}</strong>
                          <div className="muted">{item.product_sku}</div>
                        </td>
                        <td>{item.qty}</td>
                        <td className="muted">{item.already_returned_qty}</td>
                        <td><strong style={{ color: item.remaining_qty > 0 ? '#16a34a' : '#94a3b8' }}>{item.remaining_qty}</strong></td>
                        <td>
                          <input type="number" min="0" max={item.remaining_qty}
                            disabled={item.remaining_qty === 0}
                            style={{ margin: 0, padding: '4px 8px' }}
                            value={entry.qty || ''}
                            placeholder="0"
                            onChange={e => handleReturnItemChange(item.id, 'qty', e.target.value)} />
                        </td>
                        <td>
                          <select style={{ margin: 0, padding: '4px 6px', fontSize: '0.85rem' }}
                            value={entry.condition || 'restockable'}
                            disabled={!entry.qty || entry.qty <= 0}
                            onChange={e => handleReturnItemChange(item.id, 'condition', e.target.value)}>
                            <option value="restockable">Restockable (Shelf)</option>
                            <option value="damaged">Damaged (Faulty)</option>
                            <option value="repair">Sent for Repair</option>
                          </select>
                        </td>
                        <td className="num">{fmtMoney(item.unit_refund_effective)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="two-col" style={{ alignItems: 'center', marginBottom: '16px' }}>
                <label>
                  Refund Method
                  <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}>
                    <option value="cash">Cash Refund (Drawer)</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                    <option value="card">Card / Bank Reversal</option>
                    <option value="credit">Customer Credit / Reduce Due</option>
                  </select>
                </label>

                <div style={{ textAlign: 'right', background: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', borderRadius: '8px' }}>
                  <div className="stat-label" style={{ color: '#b91c1c' }}>Total Refund Amount</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
                    {fmtMoney(calculatedRefund)}
                  </div>
                </div>
              </div>

              <label>
                Reason for Return
                <input placeholder="e.g. Defective headphone jack, Customer ordered wrong color"
                  value={returnReason} onChange={e => setReturnReason(e.target.value)} required />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setReturnModalSale(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingReturn || calculatedRefund <= 0}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                  {submittingReturn ? 'Processing…' : `Confirm Return (${fmtMoney(calculatedRefund)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Return Details */}
      {viewReturnDetail && (
        <div className="modal-overlay" onClick={() => setViewReturnDetail(null)}>
          <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Return Details — {viewReturnDetail.return_no}</h2>
              <button className="btn btn-link" onClick={() => setViewReturnDetail(null)}>✕</button>
            </div>
            <div>
              <div className="two-col" style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <div>Original Invoice: <strong>{viewReturnDetail.invoice_no}</strong></div>
                  <div>Customer: <strong>{viewReturnDetail.customer_name}</strong> ({viewReturnDetail.customer_phone || 'No phone'})</div>
                  <div>Date: <strong>{fmtDate(viewReturnDetail.created_at)}</strong></div>
                </div>
                <div>
                  <div>Processed by: <strong>{viewReturnDetail.cashier_name}</strong></div>
                  <div>Refund Method: <span className="badge badge-draft">{viewReturnDetail.refund_method.toUpperCase()}</span></div>
                  <div>Total Refund: <strong style={{ color: '#dc2626', fontSize: '1.1rem' }}>{fmtMoney(viewReturnDetail.total_refund)}</strong></div>
                </div>
              </div>

              {viewReturnDetail.reason && (
                <div style={{ marginBottom: '14px', fontSize: '0.9rem' }}>
                  <strong>Reason:</strong> <span className="muted">{viewReturnDetail.reason}</span>
                </div>
              )}

              <h3>Returned Items</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th>Condition</th>
                    <th className="num">Unit Price</th>
                    <th className="num">Refund Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewReturnDetail.items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.product_name}</strong>
                        <div className="muted">{item.product_sku}</div>
                      </td>
                      <td className="num">{item.qty}</td>
                      <td>
                        <span className={`badge ${item.condition === 'restockable' ? 'badge-completed' : 'badge-draft'}`}>
                          {item.condition}
                        </span>
                      </td>
                      <td className="num">{fmtMoney(item.unit_price)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmtMoney(item.refund_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setViewReturnDetail(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
