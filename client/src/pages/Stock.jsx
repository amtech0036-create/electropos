import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Stock() {
  const user = useAuth();
  const [tab, setTab] = useState('overview');
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState('');

  // Filters
  const [q, setQ] = useState('');
  const [movType, setMovType] = useState('');
  const [movFrom, setMovFrom] = useState('');
  const [movTo, setMovTo] = useState('');

  // Adjustment modal
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canAdjust = user.role === 'admin' || user.role === 'stock_manager';

  function loadProducts() {
    api.get(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ''}`)
      .then(setProducts).catch(e => setError(e.message));
  }

  function loadLowStock() {
    api.get('/api/stock/low').then(setLowStock).catch(e => setError(e.message));
  }

  function loadMovements() {
    const params = [];
    if (movType) params.push(`type=${movType}`);
    if (movFrom) params.push(`from=${movFrom}`);
    if (movTo) params.push(`to=${movTo}`);
    api.get(`/api/stock/movements${params.length ? '?' + params.join('&') : ''}`)
      .then(setMovements).catch(e => setError(e.message));
  }

  useEffect(() => {
    loadProducts();
    loadLowStock();
    loadMovements();
  }, []);

  useEffect(() => {
    if (tab === 'movements') loadMovements();
  }, [movType, movFrom, movTo]);

  async function handleAdjust(e) {
    e.preventDefault();
    const qtyChange = parseInt(adjQty, 10);
    if (!qtyChange || qtyChange === 0) return setError('Quantity change must be a non-zero integer');
    if (!adjReason.trim()) return setError('Reason is required for stock adjustments');
    setError('');
    setSubmitting(true);
    try {
      const result = await api.post(`/api/products/${adjustTarget.id}/adjust`, {
        qty_change: qtyChange,
        reason: adjReason.trim()
      });
      setAdjustTarget(null);
      setAdjQty('');
      setAdjReason('');
      loadProducts();
      loadLowStock();
      loadMovements();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Derived stats
  const totalItems = products.reduce((s, p) => s + (p.stock || 0), 0);
  const totalValue = products.reduce((s, p) => s + ((p.purchase_cost || 0) * (p.stock || 0)), 0);
  const totalRetail = products.reduce((s, p) => s + ((p.selling_price || 0) * (p.stock || 0)), 0);

  // Serials state
  const [serials, setSerials] = useState([]);
  const [serialStatus, setSerialStatus] = useState('all');
  const [serialQ, setSerialQ] = useState('');
  const [showAddSerial, setShowAddSerial] = useState(false);
  const [newSerialProdId, setNewSerialProdId] = useState('');
  const [newImei1, setNewImei1] = useState('');
  const [newImei2, setNewImei2] = useState('');
  const [newSerialNo, setNewSerialNo] = useState('');
  const [newSerialNotes, setNewSerialNotes] = useState('');
  const [submittingSerial, setSubmittingSerial] = useState(false);

  function loadSerials() {
    const params = [];
    if (serialStatus !== 'all') params.push(`status=${serialStatus}`);
    if (serialQ) params.push(`q=${encodeURIComponent(serialQ)}`);
    api.get(`/api/serials${params.length ? '?' + params.join('&') : ''}`)
      .then(setSerials).catch(e => setError(e.message));
  }

  useEffect(() => {
    if (tab === 'serials') loadSerials();
  }, [tab, serialStatus]);

  async function handleAddSerialSubmit(e) {
    e.preventDefault();
    if (!newSerialProdId) return alert('Please select a product');
    if (!newImei1.trim() && !newSerialNo.trim()) return alert('Please enter at least an IMEI 1 or Serial Number');
    setSubmittingSerial(true);
    try {
      await api.post(`/api/products/${newSerialProdId}/serials`, {
        imei_1: newImei1.trim(),
        imei_2: newImei2.trim(),
        serial_no: newSerialNo.trim(),
        notes: newSerialNotes.trim()
      });
      setShowAddSerial(false);
      setNewImei1(''); setNewImei2(''); setNewSerialNo(''); setNewSerialNotes('');
      loadSerials();
      loadProducts();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingSerial(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Stock Management</h1>
        <div className="period-tabs">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Stock Overview</button>
          <button className={tab === 'serials' ? 'active' : ''} onClick={() => setTab('serials')}>📱 Serialized Devices</button>
          <button className={tab === 'movements' ? 'active' : ''} onClick={() => setTab('movements')}>Movement History</button>
          <button className={tab === 'low' ? 'active' : ''} onClick={() => setTab('low')}>
            Low Stock {lowStock.length > 0 && <span className="badge badge-cancelled" style={{ marginLeft: '4px' }}>{lowStock.length}</span>}
          </button>
        </div>
        {canAdjust && (
          <a href="/api/stock/export.csv" className="btn" download style={{ textDecoration: 'none' }}>
            📥 Export CSV
          </a>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Active Products</div>
          <div className="stat-value">{products.length}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Total Units in Stock</div>
          <div className="stat-value">{totalItems.toLocaleString()}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Stock Value (Cost)</div>
          <div className="stat-value">{fmtMoney(totalValue)}</div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="stat-label">Retail Value</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{fmtMoney(totalRetail)}</div>
        </div>
      </div>

      {/* TAB: STOCK OVERVIEW */}
      {tab === 'overview' && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center' }}>
            <input
              placeholder="Search product name / SKU / barcode…"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadProducts()}
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={loadProducts}>Search</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th className="num">Cost</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
                <th className="num">Stock Value</th>
                <th>Alert</th>
                {canAdjust && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const isLow = p.min_stock_alert > 0 && p.stock <= p.min_stock_alert;
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.sku}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {p.brand && <span className="muted"> — {p.brand}</span>}
                    </td>
                    <td className="muted">{p.category_name || '—'}</td>
                    <td className="num">{p.purchase_cost !== undefined ? fmtMoney(p.purchase_cost) : '—'}</td>
                    <td className="num">{fmtMoney(p.selling_price)}</td>
                    <td className={`num font-bold ${isLow ? 'warn' : ''}`}>
                      {p.stock}
                      {isLow && <span style={{ fontSize: '0.75rem' }}> ⚠️</span>}
                    </td>
                    <td className="num">{p.purchase_cost !== undefined ? fmtMoney(p.purchase_cost * p.stock) : '—'}</td>
                    <td className="muted">{p.min_stock_alert > 0 ? `≤ ${p.min_stock_alert}` : '—'}</td>
                    {canAdjust && (
                      <td>
                        <button className="btn btn-link" onClick={() => { setAdjustTarget(p); setAdjQty(''); setAdjReason(''); }}>
                          Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr><td colSpan={canAdjust ? 9 : 8} className="muted" style={{ textAlign: 'center', padding: '24px' }}>No products found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: SERIALIZED DEVICES (PRD §5) */}
      {tab === 'serials' && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="Search by IMEI 1, IMEI 2, Serial #, or Product name…"
              value={serialQ}
              onChange={e => setSerialQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadSerials()}
              style={{ flex: 1, minWidth: '220px' }}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              {['all', 'in_stock', 'sold', 'defective'].map(st => (
                <button key={st} className={`btn ${serialStatus === st ? 'active' : ''}`}
                  onClick={() => setSerialStatus(st)}>
                  {st.replace('_', ' ').toUpperCase()}
                </button>
              ))}
            </div>
            <button className="btn" onClick={loadSerials}>Filter</button>
            {canAdjust && (
              <button className="btn btn-primary" onClick={() => setShowAddSerial(true)}>
                ＋ Register Serial Units
              </button>
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>IMEI 1</th>
                <th>IMEI 2</th>
                <th>Serial Number</th>
                <th>Status</th>
                <th>Sold Reference</th>
                <th>Customer</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {serials.map(s => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.product_name}</strong>
                    <div className="muted">{s.product_sku} {s.model ? `· ${s.model}` : ''}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{s.imei_1 || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{s.imei_2 || '—'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{s.serial_no || '—'}</td>
                  <td>
                    <span className={`badge ${s.status === 'in_stock' ? 'badge-completed' : (s.status === 'sold' ? 'badge-draft' : 'badge-cancelled')}`}>
                      {s.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{s.invoice_no ? <a href={`/sales/${s.sale_id}`}>{s.invoice_no}</a> : '—'}</td>
                  <td>{s.customer_name ? `${s.customer_name}${s.customer_phone ? ` ${s.customer_phone}` : ''}` : '—'}</td>
                  <td className="muted" style={{ maxWidth: '180px' }}>{s.notes || '—'}</td>
                </tr>
              ))}
              {serials.length === 0 && (
                <tr><td colSpan="8" className="muted" style={{ textAlign: 'center', padding: '24px' }}>No serialized devices found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB: MOVEMENT HISTORY */}
      {tab === 'movements' && (
        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={movType} onChange={e => setMovType(e.target.value)} style={{ width: '150px' }}>
              <option value="">All Types</option>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
              <option value="return">Return</option>
              <option value="adjustment">Adjustment</option>
              <option value="opening">Opening Stock</option>
            </select>
            <label style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
              From: <input type="date" value={movFrom} onChange={e => setMovFrom(e.target.value)} style={{ width: 'auto' }} />
            </label>
            <label style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
              To: <input type="date" value={movTo} onChange={e => setMovTo(e.target.value)} style={{ width: 'auto' }} />
            </label>
            <button className="btn" onClick={loadMovements}>Filter</button>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th>Source</th>
                  <th>Reason / Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id}>
                    <td className="muted"><small>{fmtDate(m.created_at)}</small></td>
                    <td>
                      <strong>{m.product_name}</strong>
                      <div className="muted"><small>{m.product_sku}</small></div>
                    </td>
                    <td>
                      <span className={`badge badge-${m.type === 'sale' ? 'cancelled' : m.type === 'purchase' || m.type === 'opening' ? 'finalized' : 'draft'}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className={`num font-bold ${m.qty > 0 ? '' : ''}`} style={{ color: m.qty > 0 ? '#16a34a' : '#dc2626' }}>
                      {m.qty > 0 ? '+' : ''}{m.qty}
                    </td>
                    <td className="muted">
                      <small>{m.source_type}{m.source_id ? ` #${m.source_id}` : ''}</small>
                    </td>
                    <td className="muted"><small>{m.reason || '—'}</small></td>
                    <td className="muted"><small>{m.username || '—'}</small></td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '24px' }}>No stock movements found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: LOW STOCK ALERTS */}
      {tab === 'low' && (
        <div className="card" style={{ marginTop: '16px' }}>
          {lowStock.length > 0 ? (
            <>
              <p className="muted">
                These products are at or below their minimum stock alert level and may need replenishment.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Current Stock</th>
                    <th className="num">Min Alert</th>
                    <th className="num">Deficit</th>
                    <th className="num">Cost</th>
                    {canAdjust && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map(p => {
                    const deficit = Math.max(0, p.min_stock_alert - p.stock);
                    return (
                      <tr key={p.id}>
                        <td className="muted">{p.sku}</td>
                        <td>
                          <strong>{p.name}</strong>
                          {p.brand && <span className="muted"> — {p.brand}</span>}
                        </td>
                        <td className="muted">{p.category_name || '—'}</td>
                        <td className="num warn font-bold">{p.stock} ⚠️</td>
                        <td className="num">{p.min_stock_alert}</td>
                        <td className="num" style={{ color: '#dc2626' }}>
                          {deficit > 0 ? `Need ${deficit}+` : 'At limit'}
                        </td>
                        <td className="num">{fmtMoney(p.purchase_cost)}</td>
                        {canAdjust && (
                          <td>
                            <button className="btn btn-link" onClick={() => { setAdjustTarget(p); setAdjQty(String(deficit || 1)); setAdjReason('Restocking'); }}>
                              Adjust
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
              ✅ All products are above their minimum stock levels. No replenishment needed.
            </div>
          )}
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {adjustTarget && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Stock Adjustment</h2>
              <button className="btn-link" onClick={() => setAdjustTarget(null)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <strong>{adjustTarget.name}</strong>
              <span className="muted"> ({adjustTarget.sku})</span>
              <div style={{ marginTop: '4px' }}>
                Current stock: <strong>{adjustTarget.stock}</strong>
              </div>
            </div>

            <form onSubmit={handleAdjust}>
              <label>
                Quantity Change *
                <input
                  type="number"
                  required
                  placeholder="e.g. +5 or -2"
                  value={adjQty}
                  onChange={e => setAdjQty(e.target.value)}
                />
                <div className="muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                  Positive to add stock, negative to remove. New stock will be: <strong>{adjustTarget.stock + (parseInt(adjQty, 10) || 0)}</strong>
                </div>
              </label>

              <label>
                Reason *
                <select
                  value={adjReason}
                  onChange={e => setAdjReason(e.target.value)}
                >
                  <option value="">Select reason…</option>
                  <option value="Physical count correction">Physical count correction</option>
                  <option value="Damaged / defective">Damaged / defective</option>
                  <option value="Restocking">Restocking</option>
                  <option value="Theft / shrinkage">Theft / shrinkage</option>
                  <option value="Return to supplier">Return to supplier</option>
                  <option value="Sample / display">Sample / display</option>
                  <option value="__custom__">Other (custom reason)…</option>
                </select>
              </label>

              {adjReason === '__custom__' && (
                <label>
                  Custom Reason *
                  <input
                    required
                    placeholder="Describe the reason for this adjustment…"
                    value=""
                    onChange={e => setAdjReason(e.target.value)}
                  />
                </label>
              )}

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setAdjustTarget(null)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !adjQty || parseInt(adjQty, 10) === 0 || !adjReason || adjReason === '__custom__'}
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER SERIAL UNITS (PRD §5) */}
      {showAddSerial && (
        <div className="modal-overlay" onClick={() => setShowAddSerial(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Register Serial / IMEI Units</h2>
              <button className="btn btn-link" onClick={() => setShowAddSerial(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSerialSubmit}>
              <label>
                Select Serialized Product *
                <select
                  required
                  value={newSerialProdId}
                  onChange={e => setNewSerialProdId(e.target.value)}
                >
                  <option value="">-- Choose Product --</option>
                  {products.filter(p => p.tracking_type === 'serial').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current Stock: {p.stock}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                IMEI 1 (15 digits or barcode)
                <input
                  placeholder="e.g. 352849102938471"
                  value={newImei1}
                  onChange={e => setNewImei1(e.target.value)}
                />
              </label>

              <label>
                IMEI 2 (Optional for dual-SIM phones)
                <input
                  placeholder="e.g. 352849102938472"
                  value={newImei2}
                  onChange={e => setNewImei2(e.target.value)}
                />
              </label>

              <label>
                Serial Number (Laptops / Desktops / Monitors / Devices)
                <input
                  placeholder="e.g. R58N102ABC or PF39XK21"
                  value={newSerialNo}
                  onChange={e => setNewSerialNo(e.target.value)}
                />
              </label>

              <label>
                Device Notes / Condition (Optional)
                <input
                  placeholder="e.g. Factory sealed box, Official BTRC approved"
                  value={newSerialNotes}
                  onChange={e => setNewSerialNotes(e.target.value)}
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowAddSerial(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingSerial || !newSerialProdId || (!newImei1.trim() && !newSerialNo.trim())}
                >
                  {submittingSerial ? 'Registering…' : 'Add Unit to Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
