import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fmtMoney } from '../api.js';

export default function POS() {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(1);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [method, setMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // completed sale summary
  const [serialsCache, setSerialsCache] = useState({}); // productId -> available in_stock serials[]
  const searchRef = useRef(null);
  // Idempotency key per cart session — regenerated after each completed sale
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => { api.get('/api/customers').then(setCustomers).catch(() => {}); }, []);

  // Fetch available in_stock serials for a product if serialized
  async function loadSerials(productId) {
    if (serialsCache[productId]) return serialsCache[productId];
    try {
      const list = await api.get(`/api/products/${productId}/serials?status=in_stock`);
      setSerialsCache(prev => ({ ...prev, [productId]: list }));
      return list;
    } catch {
      return [];
    }
  }

  // Search as you type (name, SKU, barcode, IMEI — PRD 4.3). Debounced.
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api.get(`/api/products?q=${encodeURIComponent(query.trim())}`)
        .then(list => setResults(list.slice(0, 8)))
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [query]);

  async function addToCart(product, preselectedSerialId = null) {
    if (product.stock <= 0) { setError(`${product.name} is out of stock`); return; }

    let availSerials = [];
    if (product.tracking_type === 'serial') {
      availSerials = await loadSerials(product.id);
      if (availSerials.length === 0) {
        setError(`No in-stock serialized units available for ${product.name}`);
        return;
      }
    }

    setCart(prev => {
      const existing = prev.find(l => l.product.id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock) { setError(`Only ${product.stock} in stock for ${product.name}`); return prev; }
        const nextQty = existing.qty + 1;
        const currentSelected = existing.selected_serials || [];
        // If preselected, append it; otherwise try to auto-select next available serial
        let nextSelected = [...currentSelected];
        if (preselectedSerialId && !nextSelected.includes(preselectedSerialId)) {
          nextSelected.push(preselectedSerialId);
        } else if (product.tracking_type === 'serial') {
          const unused = availSerials.find(s => !nextSelected.includes(s.id));
          if (unused) nextSelected.push(unused.id);
        }

        return prev.map(l => l.product.id === product.id ? {
          ...l,
          qty: nextQty,
          selected_serials: nextSelected
        } : l);
      }

      // New line
      let initialSelected = [];
      if (preselectedSerialId) {
        initialSelected = [preselectedSerialId];
      } else if (product.tracking_type === 'serial' && availSerials.length > 0) {
        initialSelected = [availSerials[0].id];
      }

      return [...prev, {
        product,
        qty: 1,
        unit_price: product.selling_price,
        discount: 0,
        selected_serials: initialSelected
      }];
    });

    setQuery(''); setResults([]); setError('');
    searchRef.current?.focus();
  }

  // Barcode / IMEI scanner handler on Enter
  async function onSearchKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const term = query.trim();
      if (!term) return;

      // 1. First check if it matches an IMEI or serial directly
      try {
        const lookup = await api.get(`/api/serials/lookup?q=${encodeURIComponent(term)}`);
        if (lookup.found && lookup.matches.length > 0) {
          const serialMatch = lookup.matches.find(m => m.status === 'in_stock');
          if (serialMatch) {
            const prod = await api.get(`/api/products/${serialMatch.product_id}`);
            if (prod) {
              await addToCart(prod, serialMatch.id);
              return;
            }
          }
        }
      } catch {
        // continue to normal product match
      }

      // 2. Exact barcode or top product match
      if (results.length > 0) {
        const exact = results.find(p => p.barcode === term);
        addToCart(exact || results[0]);
      }
    }
  }

  function setLine(productId, patch) {
    setCart(prev => prev.map(l => {
      if (l.product.id !== productId) return l;
      const next = { ...l, ...patch };
      if (next.qty > l.product.stock) { setError(`Only ${l.product.stock} in stock`); next.qty = l.product.stock; }
      if (next.qty < 1) next.qty = 1;
      if (next.discount < 0) next.discount = 0;
      return next;
    }));
    setError('');
  }

  function handleSerialSelect(productId, index, serialId) {
    setCart(prev => prev.map(l => {
      if (l.product.id !== productId) return l;
      const current = [...(l.selected_serials || [])];
      current[index] = serialId ? parseInt(serialId, 10) : null;
      return { ...l, selected_serials: current };
    }));
  }

  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const itemDiscounts = cart.reduce((s, l) => s + l.discount, 0);
  const afterItemDisc = subtotal - itemDiscounts;
  const invDisc = Math.min(Number(invoiceDiscount) || 0, afterItemDisc);
  const total = afterItemDisc - invDisc;
  const paid = Number(paidAmount) || 0;
  const due = Math.max(0, total - paid);

  async function confirmSale() {
    if (cart.length === 0) { setError('Cart is empty'); return; }

    // Validate serial selection for serialized lines
    for (const line of cart) {
      if (line.product.tracking_type === 'serial') {
        const selected = (line.selected_serials || []).filter(Boolean);
        if (selected.length !== line.qty) {
          setError(`Please select ${line.qty} serial/IMEI unit(s) for ${line.product.name}`);
          return;
        }
        // Check uniqueness within the same product line
        const uniqueSet = new Set(selected);
        if (uniqueSet.size !== selected.length) {
          setError(`Duplicate serial selected for ${line.product.name}. Each unit must have a unique IMEI/Serial.`);
          return;
        }
      }
    }

    setBusy(true); setError('');
    try {
      const result = await api.post('/api/sales', {
        customer_id: customerId,
        items: cart.map(l => ({
          product_id: l.product.id,
          qty: l.qty,
          unit_price: l.unit_price,
          discount: l.discount,
          serial_ids: l.product.tracking_type === 'serial' ? (l.selected_serials || []).filter(Boolean) : undefined
        })),
        payments: paid > 0 ? [{ method, amount: paid }] : [],
        invoice_discount: invDisc,
        idempotency_key: idemKey
      });
      setDone(result);
      setCart([]); setInvoiceDiscount(0); setPaidAmount(''); setCustomerId(1);
      setIdemKey(crypto.randomUUID());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() { setDone(null); setCart([]); setPaidAmount(''); setError(''); searchRef.current?.focus(); }

  if (done) {
    return (
      <div className="pos-done card">
        <h2>✓ Sale complete</h2>
        <p>Invoice <strong>{done.invoice_no}</strong></p>
        <p>Total: <strong>{fmtMoney(done.total)}</strong></p>
        {done.due > 0 && <p className="warn">Due: {fmtMoney(done.due)}</p>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => nav(`/sales/${done.id}`)}>Print invoice</button>
          <button className="btn" onClick={reset}>New sale</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pos">
      <div className="pos-left">
        <div className="search-bar">
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder="Scan barcode, scan device IMEI, or search product name / SKU…"
            className="search-input"
          />
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map(p => (
              <button key={p.id} className="result-row" onClick={() => addToCart(p)} disabled={p.stock <= 0}>
                <div>
                  <span className="result-name">{p.name}</span>
                  {p.tracking_type === 'serial' && (
                    <span className="badge badge-draft" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>IMEI Tracked</span>
                  )}
                </div>
                <span className="muted">{p.sku} · {p.category_name}</span>
                <span className="result-price">{fmtMoney(p.selling_price)}</span>
                <span className={p.stock <= 0 ? 'warn' : 'muted'}>{p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`}</span>
              </button>
            ))}
          </div>
        )}

        <div className="card">
          <h3>Cart</h3>
          {cart.length === 0 && <p className="muted">Add products or scan barcode to start a sale.</p>}
          {cart.length > 0 && (
            <table>
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Price</th><th>Discount</th><th className="num">Line total</th><th></th></tr>
              </thead>
              <tbody>
                {cart.map(l => {
                  const isSerialized = l.product.tracking_type === 'serial';
                  const availableSerials = serialsCache[l.product.id] || [];

                  return (
                    <React.Fragment key={l.product.id}>
                      <tr>
                        <td>
                          <strong>{l.product.name}</strong>
                          {isSerialized && (
                            <span className="badge badge-draft" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>
                              Serialized
                            </span>
                          )}
                        </td>
                        <td>
                          <input type="number" min="1" value={l.qty}
                            onChange={e => setLine(l.product.id, { qty: parseInt(e.target.value, 10) || 1 })}
                            className="qty-input" />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" value={l.unit_price}
                            onChange={e => setLine(l.product.id, { unit_price: parseFloat(e.target.value) || 0 })}
                            className="price-input" />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" value={l.discount}
                            onChange={e => setLine(l.product.id, { discount: parseFloat(e.target.value) || 0 })}
                            className="price-input" />
                        </td>
                        <td className="num">{fmtMoney(l.unit_price * l.qty - l.discount)}</td>
                        <td>
                          <button className="btn btn-link danger" onClick={() => setCart(c => c.filter(x => x.product.id !== l.product.id))}>✕</button>
                        </td>
                      </tr>

                      {/* Serial / IMEI selection picker row for serialized products (PRD §5) */}
                      {isSerialized && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan="6" style={{ padding: '6px 12px 10px 12px', borderBottom: '2px solid var(--border)' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                              📱 Select Device Serial / IMEI for this unit ({l.qty} required):
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {Array.from({ length: l.qty }).map((_, idx) => {
                                const selectedId = (l.selected_serials || [])[idx] || '';
                                return (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span className="muted" style={{ fontSize: '0.78rem' }}>Unit #{idx + 1}:</span>
                                    <select
                                      style={{ width: 'auto', padding: '4px 8px', fontSize: '0.82rem', margin: 0 }}
                                      value={selectedId}
                                      onChange={e => handleSerialSelect(l.product.id, idx, e.target.value)}>
                                      <option value="">-- Choose IMEI/Serial --</option>
                                      {availableSerials.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.imei_1 ? `IMEI: ${s.imei_1}` : ''} {s.serial_no ? `SN: ${s.serial_no}` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="pos-right card">
        <label>Customer
          <select value={customerId} onChange={e => setCustomerId(Number(e.target.value))}>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
          </select>
        </label>
        <button className="btn btn-link" onClick={async () => {
          const name = prompt('Quick add customer name:');
          if (!name) return;
          const c = await api.post('/api/customers', { name });
          const list = await api.get('/api/customers');
          setCustomers(list); setCustomerId(c.id);
        }}>＋ Quick add customer</button>

        <label>Invoice discount (৳)
          <input type="number" min="0" step="0.01" value={invoiceDiscount} onChange={e => setInvoiceDiscount(parseFloat(e.target.value) || 0)} />
        </label>

        <div className="totals">
          <div><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div>
          {itemDiscounts > 0 && <div><span>Item discounts</span><span>−{fmtMoney(itemDiscounts)}</span></div>}
          {invDisc > 0 && <div><span>Invoice discount</span><span>−{fmtMoney(invDisc)}</span></div>}
          <div className="grand"><span>Total</span><span>{fmtMoney(total)}</span></div>
        </div>

        <label>Payment method
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
          </select>
        </label>
        <label>Amount received (৳) — leave empty for full due
          <input type="number" min="0" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="0" />
        </label>
        {due > 0 && <div className="due-line warn">Due: {fmtMoney(due)}</div>}
        {paid > total && <div className="muted">Change: {fmtMoney(paid - total)}</div>}

        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary btn-big" onClick={confirmSale} disabled={busy || cart.length === 0}>
          {busy ? 'Saving…' : `Confirm sale — ${fmtMoney(total)}`}
        </button>
      </div>
    </div>
  );
}
