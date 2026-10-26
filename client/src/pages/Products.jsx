import React, { useEffect, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import { useAuth } from '../App.jsx';
import CategoryModal from '../components/CategoryModal.jsx';

const EMPTY = { name: '', category_id: '', brand: '', model: '', purchase_cost: '', selling_price: '', min_stock_alert: 0, opening_stock: 0, tracking_type: 'quantity', barcode: '' };

export default function Products() {
  const user = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [quickAddCat, setQuickAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [error, setError] = useState('');
  const canManage = user.role === 'admin' || user.role === 'stock_manager';

  function load(query = '') {
    api.get(`/api/products${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setProducts).catch(e => setError(e.message));
  }

  function loadCategories() {
    api.get('/api/categories').then(setCategories).catch(() => {});
  }

  useEffect(() => {
    load();
    loadCategories();
  }, []);

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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input placeholder="Search name / SKU / barcode / brand…" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(q)}
            style={{ width: '240px', margin: 0 }} />
          <button className="btn" onClick={() => load(q)}>Search</button>
          {canManage && (
            <>
              <button className="btn" onClick={() => setShowCategoryModal(true)}>
                📁 Categories ({categories.length})
              </button>
              <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}>
                {showForm ? 'Close' : '＋ Add product'}
              </button>
            </>
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}

      {showForm && (
        <form className="card form-grid" onSubmit={save}>
          <label>Name *<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ margin: 0 }}>Category *</label>
              <button
                type="button"
                className="btn btn-link"
                style={{ padding: 0, fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600 }}
                onClick={() => setQuickAddCat(v => !v)}
              >
                {quickAddCat ? '✕ Cancel' : '＋ Quick Add'}
              </button>
            </div>

            {quickAddCat ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  autoFocus
                  placeholder="New category name…"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  style={{ margin: 0 }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap', padding: '6px 12px' }}
                  onClick={async () => {
                    if (!newCatName.trim()) return;
                    try {
                      const created = await api.post('/api/categories', { name: newCatName.trim() });
                      const updatedCats = await api.get('/api/categories');
                      setCategories(updatedCats);
                      setForm({ ...form, category_id: created.id });
                      setNewCatName('');
                      setQuickAddCat(false);
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                >
                  Save & Select
                </button>
              </div>
            ) : (
              <select
                required
                value={form.category_id}
                onChange={e => {
                  if (e.target.value === '__manage__') {
                    setShowCategoryModal(true);
                    return;
                  }
                  setForm({ ...form, category_id: e.target.value });
                }}
              >
                <option value="">Select category…</option>
                {categories.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="__manage__">＋ Manage / Edit Categories…</option>
              </select>
            )}
          </div>
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

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table>
            <thead><tr><th>SKU</th><th>Name</th><th>Category</th><th className="num">Cost</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className={p.active ? '' : 'cancelled'}>
                  <td>{p.sku}</td>
                  <td>{p.name}{p.brand ? ` — ${p.brand}` : ''}</td>
                  <td><span className="badge badge-draft" style={{ fontSize: '0.78rem' }}>{p.category_name}</span></td>
                  <td className="num">{p.purchase_cost !== undefined ? fmtMoney(p.purchase_cost) : '—'}</td>
                  <td className="num">{fmtMoney(p.selling_price)}</td>
                  <td className={`num ${p.stock <= (p.min_stock_alert || 0) && p.min_stock_alert > 0 ? 'warn' : ''}`}>{p.stock}</td>
                  <td>{p.active ? <span style={{ color: '#16a34a' }}>Active</span> : <span className="muted">Inactive</span>}</td>
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

      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onCategoryUpdated={async () => {
            const list = await api.get('/api/categories');
            setCategories(list);
            load(q);
          }}
        />
      )}
    </div>
  );
}
