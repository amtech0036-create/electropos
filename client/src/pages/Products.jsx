import React, { useEffect, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import { useAuth } from '../App.jsx';

const EMPTY = { name: '', category_id: '', brand: '', model: '', purchase_cost: '', selling_price: '', min_stock_alert: 0, opening_stock: 0, tracking_type: 'quantity', barcode: '' };

export default function Products() {
  const user = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const canManage = user.role === 'admin' || user.role === 'stock_manager';

  function load(query = '') {
    api.get(`/api/products${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setProducts).catch(e => setError(e.message));
  }

  useEffect(() => { load(); api.get('/api/categories').then(setCategories).catch(() => {}); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/products', { ...form, category_id: Number(form.category_id) });
      setForm(EMPTY); setShowForm(false); load(q);
    } catch (err) { setError(err.message); }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Products</h1>
        <input placeholder="Search name / SKU / barcode / brand…" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(q)} />
        <button className="btn" onClick={() => load(q)}>Search</button>
        {canManage && <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>{showForm ? 'Close' : '＋ Add product'}</button>}
      </div>
      {error && <div className="error">{error}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={save}>
          <label>Name *<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>Category *
            <select required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select…</option>
              {categories.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Brand<input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></label>
          <label>Model<input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
          <label>Barcode<input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></label>
          <label>Purchase cost (৳) *<input type="number" step="0.01" min="0" required value={form.purchase_cost} onChange={e => setForm({ ...form, purchase_cost: e.target.value })} /></label>
          <label>Selling price (৳) *<input type="number" step="0.01" min="0" required value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} /></label>
          <label>Min stock alert<input type="number" min="0" value={form.min_stock_alert} onChange={e => setForm({ ...form, min_stock_alert: Number(e.target.value) })} /></label>
          <label>Opening stock<input type="number" min="0" value={form.opening_stock} onChange={e => setForm({ ...form, opening_stock: Number(e.target.value) })} /></label>
          <label>Tracking
            <select value={form.tracking_type} onChange={e => setForm({ ...form, tracking_type: e.target.value })}>
              <option value="quantity">Quantity-based</option>
              <option value="serial">Serial / IMEI tracked</option>
            </select>
          </label>
          <button className="btn btn-primary">Save product</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th className="num">Cost</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className={p.active ? '' : 'cancelled'}>
                <td>{p.sku}</td>
                <td>{p.name}{p.brand ? ` — ${p.brand}` : ''}</td>
                <td>{p.category_name}</td>
                <td className="num">{p.purchase_cost !== undefined ? fmtMoney(p.purchase_cost) : '—'}</td>
                <td className="num">{fmtMoney(p.selling_price)}</td>
                <td className={`num ${p.stock <= (p.min_stock_alert || 0) && p.min_stock_alert > 0 ? 'warn' : ''}`}>{p.stock}</td>
                <td>{p.active ? 'Active' : 'Inactive'}</td>
                {canManage && (
                  <td><button className="btn btn-link danger" onClick={async () => {
                    if (!confirm(`Deactivate ${p.name}?`)) return;
                    await api.del(`/api/products/${p.id}`); load(q);
                  }}>Deactivate</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
