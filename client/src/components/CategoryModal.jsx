import React, { useState } from 'react';
import { api } from '../api.js';

export default function CategoryModal({ categories, onClose, onCategoryUpdated }) {
  const [newCatName, setNewCatName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/api/categories', { name });
      setNewCatName('');
      setSuccess(`✓ Category "${name}" added successfully.`);
      setTimeout(() => setSuccess(''), 3000);
      onCategoryUpdated();
    } catch (err) {
      setError(err.message || 'Failed to add category');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(id) {
    const name = editName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      await api.put(`/api/categories/${id}`, { name });
      setEditingId(null);
      setSuccess('✓ Category updated.');
      setTimeout(() => setSuccess(''), 2500);
      onCategoryUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update category');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(cat) {
    setError('');
    try {
      await api.put(`/api/categories/${cat.id}`, { active: !cat.active });
      onCategoryUpdated();
    } catch (err) {
      setError(err.message || 'Failed to update category status');
    }
  }

  async function handleDelete(cat) {
    if (cat.product_count > 0) {
      setError(`Cannot delete "${cat.name}": ${cat.product_count} product(s) are using it. You can deactivate it instead.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    setError('');
    try {
      await api.del(`/api/categories/${cat.id}`);
      setSuccess(`✓ Category "${cat.name}" deleted.`);
      setTimeout(() => setSuccess(''), 3000);
      onCategoryUpdated();
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    }
  }

  const filtered = categories.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>📁 Manage Product Categories</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
              Add, rename, deactivate, or delete product categories ({categories.length} total)
            </div>
          </div>
          <button type="button" className="btn-link" onClick={onClose} style={{ fontSize: '1.2rem' }}>✕</button>
        </div>

        {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}
        {success && <div style={{ background: '#dcfce7', color: '#15803d', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.88rem' }}>{success}</div>}

        {/* Add New Category Input */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(238, 242, 255, 0.7)', padding: '12px', borderRadius: '10px', border: '1px solid #c7d2fe' }}>
          <input
            required
            placeholder="Type new category name (e.g. Wireless Earbuds, Smart TVs)…"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            style={{ flex: 1, margin: 0, background: '#ffffff' }}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !newCatName.trim()} style={{ whiteSpace: 'nowrap' }}>
            {busy ? 'Adding…' : '＋ Add Category'}
          </button>
        </form>

        {/* Search filter */}
        <div style={{ marginBottom: '10px' }}>
          <input
            placeholder="Filter categories…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', margin: 0, padding: '6px 12px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Categories Table */}
        <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Category Name</th>
                <th className="num">Products</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="4" className="muted" style={{ textAlign: 'center', padding: '16px' }}>No categories found matching "{search}".</td></tr>
              ) : (
                filtered.map(c => {
                  const isEditing = editingId === c.id;
                  return (
                    <tr key={c.id}>
                      <td style={{ minWidth: '220px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              autoFocus
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveEdit(c.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              style={{ margin: 0, padding: '4px 8px', fontSize: '0.88rem' }}
                            />
                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleSaveEdit(c.id)}>
                              Save
                            </button>
                            <button className="btn" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <strong style={{ color: c.active ? '#1e293b' : '#94a3b8' }}>
                            {c.name}
                          </strong>
                        )}
                      </td>
                      <td className="num">
                        {c.product_count > 0 ? (
                          <span style={{ fontWeight: 600 }}>{c.product_count}</span>
                        ) : (
                          <span className="muted">0</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link"
                          style={{
                            padding: '2px 8px',
                            fontSize: '0.78rem',
                            borderRadius: '12px',
                            fontWeight: 600,
                            background: c.active ? '#f0fdf4' : '#f1f5f9',
                            color: c.active ? '#15803d' : '#64748b'
                          }}
                          onClick={() => handleToggleActive(c)}
                          title="Click to toggle active status"
                        >
                          {c.active ? '● Active' : '○ Inactive'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!isEditing && (
                          <>
                            <button
                              type="button"
                              className="btn btn-link"
                              style={{ padding: '4px 8px', fontSize: '0.82rem', color: '#4f46e5' }}
                              onClick={() => {
                                setEditingId(c.id);
                                setEditName(c.name);
                              }}
                            >
                              ✏️ Rename
                            </button>
                            <button
                              type="button"
                              className="btn btn-link danger"
                              style={{ padding: '4px 8px', fontSize: '0.82rem', marginLeft: '6px' }}
                              onClick={() => handleDelete(c)}
                              title={c.product_count > 0 ? 'Cannot delete: products assigned' : 'Delete category'}
                            >
                              🗑️ Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
