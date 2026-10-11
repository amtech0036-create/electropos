import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Purchases() {
  const user = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewPurchase, setViewPurchase] = useState(null);

  // New Purchase Form State
  const [supplierId, setSupplierId] = useState('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([]);
  const [purchaseDiscount, setPurchaseDiscount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const canManage = user.role === 'admin' || user.role === 'stock_manager';

  function load() {
    let url = `/api/purchases?`;
    const params = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
    if (supplierFilter) params.push(`supplier_id=${encodeURIComponent(supplierFilter)}`);
    url += params.join('&');

    api.get(url).then(setPurchases).catch(e => setError(e.message));
  }

  useEffect(() => {
    load();
    api.get('/api/suppliers').then(setSuppliers).catch(() => {});
    api.get('/api/products').then(setProducts).catch(() => {});
  }, [statusFilter, supplierFilter]);

  function handleProductSearch(term) {
    setProdSearch(term);
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = products.filter(p =>
      p.active && (
        p.name.toLowerCase().includes(term.toLowerCase()) ||
        p.sku.toLowerCase().includes(term.toLowerCase()) ||
        (p.barcode && p.barcode.includes(term))
      )
    );
    setSearchResults(filtered.slice(0, 8));
  }

  function addItem(product) {
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      setItems(items.map(i => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setItems([...items, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit_cost: product.purchase_cost ?? 0,
        qty: 1,
        discount: 0
      }]);
    }
    setProdSearch('');
    setSearchResults([]);
  }

  function updateItem(index, field, value) {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  }

  function removeItem(index) {
    setItems(items.filter((_, idx) => idx !== index));
  }

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const cost = parseFloat(item.unit_cost) || 0;
    const qty = parseInt(item.qty, 10) || 0;
    const disc = parseFloat(item.discount) || 0;
    return sum + (cost * qty - disc);
  }, 0);

  const discountVal = parseFloat(purchaseDiscount) || 0;
  const grandTotal = Math.max(0, subtotal - discountVal);
  const paidVal = Math.min(grandTotal, parseFloat(amountPaid) || 0);
  const dueVal = Math.max(0, grandTotal - paidVal);

  async function handleCreatePurchase(finalize = false) {
    if (!supplierId) return setError('Please select a supplier');
    if (items.length === 0) return setError('Please add at least one product');
    setError('');
    setSubmitting(true);

    try {
      await api.post('/api/purchases', {
        supplier_id: Number(supplierId),
        supplier_invoice_no: supplierInvoiceNo,
        purchase_date: purchaseDate,
        items: items.map(i => ({
          product_id: i.product_id,
          qty: Number(i.qty),
          unit_cost: parseFloat(i.unit_cost),
          discount: parseFloat(i.discount || 0)
        })),
        discount: discountVal,
        paid: paidVal,
        payment_method: paymentMethod,
        finalize,
        notes,
        idempotency_key: `pur-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      });

      setShowModal(false);
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSupplierId('');
    setSupplierInvoiceNo('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setPurchaseDiscount('');
    setAmountPaid('');
    setPaymentMethod('cash');
    setNotes('');
    setProdSearch('');
    setSearchResults([]);
  }

  async function openPurchaseDetail(p) {
    try {
      const full = await api.get(`/api/purchases/${p.id}`);
      setViewPurchase(full);
    } catch (err) {
      setError(err.message);
    }
  }

  async function finalizePurchase(id) {
    const pay = prompt('Enter payment amount to pay supplier now (৳):', '0');
    if (pay === null) return;
    try {
      await api.post(`/api/purchases/${id}/finalize`, { paid: parseFloat(pay) || 0 });
      load();
      if (viewPurchase?.id === id) openPurchaseDetail({ id });
    } catch (err) {
      setError(err.message);
    }
  }

  async function cancelPurchase(id) {
    const reason = prompt('Cancellation reason:');
    if (reason === null) return;
    try {
      await api.post(`/api/purchases/${id}/cancel`, { reason });
      load();
      if (viewPurchase?.id === id) openPurchaseDetail({ id });
    } catch (err) {
      setError(err.message);
    }
  }

  // Summary figures
  const totalAmount = purchases.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.total, 0);
  const totalPaid = purchases.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.paid, 0);
  const totalDue = purchases.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.due, 0);

  return (
    <div>
      <div className="page-head">
        <h1>Purchases</h1>
        <input
          placeholder="Search purchase / invoice / supplier…"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: '130px' }}>
          <option value="">All Statuses</option>
          <option value="finalized">Finalized</option>
          <option value="draft">Draft</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ width: '170px' }}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn" onClick={load}>Filter</button>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            ＋ New Purchase
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Purchases Value</div>
          <div className="stat-value">{fmtMoney(totalAmount)}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Amount Paid</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{fmtMoney(totalPaid)}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Supplier Due</div>
          <div className="stat-value" style={{ color: totalDue > 0 ? '#dc2626' : 'inherit' }}>{fmtMoney(totalDue)}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <table>
          <thead>
            <tr>
              <th>Purchase No</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th className="num">Due</th>
              <th>Recorded By</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id} className={p.status === 'cancelled' ? 'cancelled' : ''}>
                <td>
                  <strong>{p.purchase_no}</strong>
                  {p.supplier_invoice_no && <div className="muted"><small>Ref: {p.supplier_invoice_no}</small></div>}
                </td>
                <td>{p.supplier_name}</td>
                <td className="muted">{p.purchase_date}</td>
                <td>
                  <span className={`badge badge-${p.status}`}>
                    {p.status.toUpperCase()}
                  </span>
                </td>
                <td className="num">{fmtMoney(p.total)}</td>
                <td className="num">{fmtMoney(p.paid)}</td>
                <td className="num">{p.due > 0 ? <span className="warn">{fmtMoney(p.due)}</span> : '—'}</td>
                <td>{p.user_name}</td>
                <td>
                  <button className="btn btn-link" onClick={() => openPurchaseDetail(p)}>View</button>
                  {p.status === 'draft' && canManage && (
                    <button className="btn btn-link" style={{ color: '#16a34a' }} onClick={() => finalizePurchase(p.id)}>
                      Finalize
                    </button>
                  )}
                  {p.status !== 'cancelled' && canManage && (
                    <button className="btn btn-link danger" onClick={() => cancelPurchase(p.id)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr><td colSpan="9" className="muted" style={{ textAlign: 'center', padding: '24px' }}>No purchases found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE PURCHASE MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-box modal-wide">
            <div className="modal-head">
              <h2>New Purchase Bill</h2>
              <button className="btn-link" onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className="form-grid" style={{ marginBottom: '16px' }}>
              <label>
                Supplier *
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
                  <option value="">Select Supplier…</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.company_name || 'Individual'})</option>)}
                </select>
              </label>

              <label>
                Supplier Bill / Invoice Ref #
                <input
                  placeholder="e.g. ST-98421"
                  value={supplierInvoiceNo}
                  onChange={e => setSupplierInvoiceNo(e.target.value)}
                />
              </label>

              <label>
                Purchase Date
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </label>
            </div>

            {/* Product search box */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                className="search-input"
                placeholder="🔍 Scan barcode or search product name / SKU to add…"
                value={prodSearch}
                onChange={e => handleProductSearch(e.target.value)}
              />
              {searchResults.length > 0 && (
                <div className="search-results" style={{ position: 'absolute', width: '100%', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                  {searchResults.map(p => (
                    <div
                      key={p.id}
                      className="result-row"
                      onClick={() => addItem(p)}
                      style={{ padding: '8px 12px' }}
                    >
                      <div><strong>{p.name}</strong> <span className="muted">({p.sku})</span></div>
                      <div className="num">Cost: {fmtMoney(p.purchase_cost)}</div>
                      <div className="num">Stock: {p.stock}</div>
                      <button className="btn btn-primary" style={{ padding: '4px 10px' }}>＋ Add</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Purchase Items Table */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '16px' }}>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ width: '110px' }}>Unit Cost (৳)</th>
                    <th style={{ width: '80px' }}>Qty</th>
                    <th style={{ width: '90px' }}>Discount</th>
                    <th className="num" style={{ width: '100px' }}>Line Total</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const line = (parseFloat(item.unit_cost) || 0) * (parseInt(item.qty, 10) || 0) - (parseFloat(item.discount) || 0);
                    return (
                      <tr key={item.product_id}>
                        <td>
                          <strong>{item.name}</strong>
                          <div className="muted"><small>{item.sku}</small></div>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unit_cost}
                            onChange={e => updateItem(idx, 'unit_cost', e.target.value)}
                            style={{ margin: 0, padding: '4px 6px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                            style={{ margin: 0, padding: '4px 6px' }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.discount}
                            onChange={e => updateItem(idx, 'discount', e.target.value)}
                            style={{ margin: 0, padding: '4px 6px' }}
                          />
                        </td>
                        <td className="num font-bold">{fmtMoney(line)}</td>
                        <td>
                          <button className="btn-link danger" onClick={() => removeItem(idx)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '24px' }}>Search and add products above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom summary and payment */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              <div>
                <label>
                  Notes / Supplier Terms
                  <textarea
                    rows="3"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}
                    placeholder="Enter any supplier warranty or delivery notes…"
                  />
                </label>
              </div>

              <div className="totals">
                <div><span>Subtotal:</span> <strong>{fmtMoney(subtotal)}</strong></div>
                <div>
                  <span>Purchase Discount (৳):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={purchaseDiscount}
                    onChange={e => setPurchaseDiscount(e.target.value)}
                    style={{ width: '110px', margin: 0, padding: '3px 6px', textAlign: 'right' }}
                  />
                </div>
                <div className="grand"><span>Total:</span> <strong>{fmtMoney(grandTotal)}</strong></div>
                <div style={{ marginTop: '8px' }}>
                  <span>Amount Paid Now (৳):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    style={{ width: '110px', margin: 0, padding: '3px 6px', textAlign: 'right' }}
                  />
                </div>
                <div>
                  <span>Payment Method:</span>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                    style={{ width: '110px', margin: 0, padding: '3px 6px' }}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank / Card</option>
                    <option value="bkash">bKash</option>
                    <option value="nagad">Nagad</option>
                  </select>
                </div>
                <div className="due-line">
                  <span>Balance Due to Supplier:</span>
                  <strong className={dueVal > 0 ? 'warn' : ''}>{fmtMoney(dueVal)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
              <button
                className="btn"
                style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#b45309' }}
                onClick={() => handleCreatePurchase(false)}
                disabled={submitting}
              >
                💾 Save as Draft (No stock change)
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleCreatePurchase(true)}
                disabled={submitting}
              >
                ✓ Finalize & Add to Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PURCHASE DETAIL MODAL */}
      {viewPurchase && (
        <div className="modal-overlay">
          <div className="modal-box modal-wide">
            <div className="modal-head">
              <div>
                <h2>{viewPurchase.purchase_no}</h2>
                <div className="muted">
                  Supplier: <strong>{viewPurchase.supplier_name}</strong> {viewPurchase.supplier_company && `(${viewPurchase.supplier_company})`}
                  · Date: {viewPurchase.purchase_date}
                  {viewPurchase.supplier_invoice_no && ` · Ref: ${viewPurchase.supplier_invoice_no}`}
                </div>
              </div>
              <button className="btn-link" onClick={() => setViewPurchase(null)}>✕</button>
            </div>

            <div style={{ margin: '12px 0' }}>
              <span className={`badge badge-${viewPurchase.status}`} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
                Status: {viewPurchase.status.toUpperCase()}
              </span>
              {viewPurchase.status === 'draft' && (
                <span className="muted" style={{ marginLeft: '12px' }}>
                  (Draft purchases do not alter stock until finalized)
                </span>
              )}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th className="num">Unit Cost</th>
                  <th className="num">Qty</th>
                  <th className="num">Discount</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewPurchase.items.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td className="muted">{item.product_sku}</td>
                    <td className="num">{fmtMoney(item.unit_cost)}</td>
                    <td className="num">{item.qty}</td>
                    <td className="num">{item.discount > 0 ? fmtMoney(item.discount) : '—'}</td>
                    <td className="num font-bold">{fmtMoney(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginTop: '16px' }}>
              <div>
                {viewPurchase.payments && viewPurchase.payments.length > 0 && (
                  <div>
                    <h4>Payment Records</h4>
                    <table>
                      <thead><tr><th>Date</th><th>Method</th><th className="num">Amount</th></tr></thead>
                      <tbody>
                        {viewPurchase.payments.map(p => (
                          <tr key={p.id}>
                            <td className="muted">{fmtDate(p.created_at)}</td>
                            <td>{p.method}</td>
                            <td className="num">{fmtMoney(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {viewPurchase.notes && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>Notes:</strong> <span className="muted">{viewPurchase.notes}</span>
                  </div>
                )}
              </div>

              <div className="totals">
                <div><span>Subtotal:</span> <strong>{fmtMoney(viewPurchase.subtotal)}</strong></div>
                {viewPurchase.discount > 0 && (
                  <div><span>Discount:</span> <strong>-{fmtMoney(viewPurchase.discount)}</strong></div>
                )}
                <div className="grand"><span>Total:</span> <strong>{fmtMoney(viewPurchase.total)}</strong></div>
                <div><span>Paid:</span> <strong style={{ color: '#16a34a' }}>{fmtMoney(viewPurchase.paid)}</strong></div>
                <div className="due-line">
                  <span>Due:</span>
                  <strong className={viewPurchase.due > 0 ? 'warn' : ''}>{fmtMoney(viewPurchase.due)}</strong>
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn" onClick={() => setViewPurchase(null)}>Close</button>
              {viewPurchase.status === 'draft' && canManage && (
                <button className="btn btn-primary" onClick={() => finalizePurchase(viewPurchase.id)}>
                  ✓ Finalize & Receive Stock
                </button>
              )}
              {viewPurchase.status !== 'cancelled' && canManage && (
                <button className="btn btn-link danger" onClick={() => cancelPurchase(viewPurchase.id)}>
                  Cancel Purchase
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
