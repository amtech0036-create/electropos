import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Settings() {
  const user = useAuth();
  const [tab, setTab] = useState('shop');
  const [settings, setSettings] = useState({});
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '', role: 'cashier' });

  // Backup & Restore
  const [backupInfo, setBackupInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');

  // License & Subscription
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [activating, setActivating] = useState(false);

  const isAdmin = user.role === 'admin';

  function loadSettings() {
    api.get('/api/settings').then(setSettings).catch(e => setError(e.message));
  }

  function loadUsers() {
    api.get('/api/users').then(setUsers).catch(e => setError(e.message));
  }

  function loadBackupInfo() {
    api.get('/api/backup/info').then(setBackupInfo).catch(() => {});
  }

  function loadLicenseInfo() {
    api.get('/api/license/status').then(setLicenseInfo).catch(() => {});
  }

  async function handleActivateLicense(e) {
    e.preventDefault();
    if (!activationKeyInput.trim()) return;
    setActivating(true);
    setError(''); setSuccess('');
    try {
      await api.post('/api/license/activate', {
        license_key: activationKeyInput.trim(),
        device_label: 'Main Terminal POS'
      });
      setSuccess('✓ Prime POS License activated successfully on this terminal!');
      setActivationKeyInput('');
      loadLicenseInfo();
    } catch (err) {
      setError(err.message);
    } finally {
      setActivating(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadLicenseInfo();
    if (isAdmin) {
      loadUsers();
      loadBackupInfo();
    }
  }, []);

  async function handleRestoreSubmit(e) {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a .db or .json backup file.');
      return;
    }
    if (!restoreConfirmed) {
      setError('Please check the confirmation box to proceed with restore.');
      return;
    }

    if (!confirm(`Are you absolutely sure you want to restore "${selectedFile.name}"? All current records will be replaced by the backup contents.`)) {
      return;
    }

    setRestoring(true);
    setError('');
    setSuccess('');
    setRestoreStatus('Uploading and verifying backup file...');

    try {
      const isJson = selectedFile.name.toLowerCase().endsWith('.json');
      let res;
      if (isJson) {
        setRestoreStatus('Parsing and importing JSON database records...');
        const text = await selectedFile.text();
        const json = JSON.parse(text);
        res = await fetch('/api/backup/restore-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
          credentials: 'same-origin'
        });
      } else {
        setRestoreStatus('Restoring full SQLite database snapshot...');
        res = await fetch('/api/backup/restore-db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: selectedFile,
          credentials: 'same-origin'
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Restore failed');

      setSuccess('✓ Database successfully restored! Please refresh the page to reload all records.');
      setSelectedFile(null);
      setRestoreConfirmed(false);
      loadBackupInfo();
      loadSettings();
      loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(false);
      setRestoreStatus('');
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSubmitting(true);
    try {
      await api.put('/api/settings', settings);
      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!userForm.username.trim() || !userForm.password) return setError('Username and password are required');
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/users', userForm);
      setShowUserModal(false);
      setUserForm({ username: '', password: '', full_name: '', role: 'cashier' });
      loadUsers();
      setSuccess('User created successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleUserActive(u) {
    try {
      await api.put(`/api/users/${u.id}`, { active: u.active ? 0 : 1 });
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(u) {
    const newPass = prompt(`Enter new password for ${u.username}:`);
    if (!newPass) return;
    try {
      await api.put(`/api/users/${u.id}`, { password: newPass });
      setSuccess(`Password updated for ${u.username}.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeUserRole(u) {
    const roles = ['admin', 'cashier', 'stock_manager'];
    const currentIdx = roles.indexOf(u.role);
    const newRole = roles[(currentIdx + 1) % roles.length];
    if (!confirm(`Change role of ${u.username} from ${u.role} to ${newRole}?`)) return;
    try {
      await api.put(`/api/users/${u.id}`, { role: newRole });
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isAdmin) {
    return (
      <div>
        <div className="page-head"><h1>Settings</h1></div>
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          🔒 Only administrators can access settings.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
        <div className="period-tabs">
          <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>Shop Profile</button>
          <button className={tab === 'invoice' ? 'active' : ''} onClick={() => setTab('invoice')}>Invoice & Tax</button>
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Users & Roles</button>
          <button className={tab === 'backup' ? 'active' : ''} onClick={() => { setTab('backup'); loadBackupInfo(); }}>Backup & Restore</button>
          <button className={tab === 'license' ? 'active' : ''} onClick={() => { setTab('license'); loadLicenseInfo(); }}>License & Subscription</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div style={{ background: '#dcfce7', color: '#15803d', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>{success}</div>}

      {/* SHOP SETTINGS */}
      {tab === 'shop' && (
        <div className="card">
          <h3>Shop Profile</h3>
          <form className="form-grid" onSubmit={handleSaveSettings}>
            <label>
              Shop Name
              <input
                value={settings.shop_name || ''}
                onChange={e => setSettings({ ...settings, shop_name: e.target.value })}
                placeholder="e.g. ElectroPOS Shop"
              />
            </label>
            <label>
              Shop Address
              <input
                value={settings.shop_address || ''}
                onChange={e => setSettings({ ...settings, shop_address: e.target.value })}
                placeholder="e.g. 123 Main Street, Dhaka"
              />
            </label>
            <label>
              Shop Phone
              <input
                value={settings.shop_phone || ''}
                onChange={e => setSettings({ ...settings, shop_phone: e.target.value })}
                placeholder="e.g. +8801700000000"
              />
            </label>
            <label>
              Shop Website
              <input
                value={settings.shop_website || ''}
                onChange={e => setSettings({ ...settings, shop_website: e.target.value })}
                placeholder="e.g. https://amtechsolutionsbd.com"
              />
            </label>
            <label>
              Currency Code
              <input
                value={settings.currency || 'BDT'}
                onChange={e => setSettings({ ...settings, currency: e.target.value })}
              />
            </label>
            <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
              <button className="btn btn-primary" disabled={submitting}>Save Settings</button>
            </div>
          </form>
        </div>
      )}

      {/* INVOICE & TAX SETTINGS */}
      {tab === 'invoice' && (
        <div className="card">
          <h3>Invoice & Tax Settings</h3>
          <form className="form-grid" onSubmit={handleSaveSettings}>
            <label>
              Invoice Number Prefix
              <input
                value={settings.invoice_prefix || 'INV-'}
                onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })}
                placeholder="e.g. INV-"
              />
            </label>
            <label>
              Purchase Number Prefix
              <input
                value={settings.purchase_prefix || 'PUR-'}
                onChange={e => setSettings({ ...settings, purchase_prefix: e.target.value })}
                placeholder="e.g. PUR-"
              />
            </label>
            <label>
              Tax / VAT Rate (%)
              <input
                type="number"
                step="0.01"
                min="0"
                value={settings.tax_rate_percent || '0'}
                onChange={e => setSettings({ ...settings, tax_rate_percent: e.target.value })}
              />
            </label>
            <label>
              Show Serial/IMEI on Invoice
              <select
                value={settings.show_serial_on_invoice || '0'}
                onChange={e => setSettings({ ...settings, show_serial_on_invoice: e.target.value })}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </label>
            <label style={{ gridColumn: '1 / -1' }}>
              Warranty Terms (printed on invoices)
              <textarea
                rows="3"
                value={settings.warranty_terms || ''}
                onChange={e => setSettings({ ...settings, warranty_terms: e.target.value })}
                placeholder="e.g. 7 days replacement, brand warranty as per manufacturer."
                style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.9rem' }}
              />
            </label>
            <div>
              <button className="btn btn-primary" disabled={submitting}>Save Settings</button>
            </div>
          </form>
        </div>
      )}

      {/* USERS & ROLES */}
      {tab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>User Accounts</h3>
            <button className="btn btn-primary" onClick={() => {
              setUserForm({ username: '', password: '', full_name: '', role: 'cashier' });
              setShowUserModal(true);
            }}>
              ＋ Add User
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.full_name || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-cancelled' : u.role === 'stock_manager' ? 'badge-draft' : 'badge-finalized'}`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{u.active ? '✅ Active' : '❌ Inactive'}</td>
                  <td>
                    <button className="btn btn-link" onClick={() => changeUserRole(u)} title="Cycle role">
                      Change Role
                    </button>
                    <button className="btn btn-link" onClick={() => resetPassword(u)}>
                      Reset Password
                    </button>
                    <button className="btn btn-link danger" onClick={() => toggleUserActive(u)}>
                      {u.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 8px' }}>Role Permissions Reference</h4>
            <table style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr><th>Role</th><th>Capabilities</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="badge badge-cancelled">admin</span></td>
                  <td>Full access — all sales, purchases, stock, expenses, settings, users, reports, cancellations</td>
                </tr>
                <tr>
                  <td><span className="badge badge-finalized">cashier</span></td>
                  <td>Create sales, view products (no cost), manage customers, collect dues, record expenses</td>
                </tr>
                <tr>
                  <td><span className="badge badge-draft">stock manager</span></td>
                  <td>Manage products & stock, purchases, suppliers, expenses; view sales (no create); see purchase costs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BACKUP & RESTORE */}
      {tab === 'backup' && (
        <div className="backup-section">
          {/* Status summary card */}
          <div className="card">
            <h3>Database Overview</h3>
            <div className="cards" style={{ marginTop: '12px', marginBottom: 0 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="stat-label">Database File Size</div>
                <div className="stat-value">
                  {backupInfo?.size_bytes ? `${(backupInfo.size_bytes / 1024).toFixed(1)} KB` : 'Ready'}
                </div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="stat-label">Total Products</div>
                <div className="stat-value">{backupInfo?.counts?.products ?? '—'}</div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="stat-label">Completed Sales</div>
                <div className="stat-value">{backupInfo?.counts?.sales ?? '—'}</div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="stat-label">Customers</div>
                <div className="stat-value">{backupInfo?.counts?.customers ?? '—'}</div>
              </div>
            </div>
          </div>

          <div className="two-col" style={{ gap: '20px' }}>
            {/* Download Backup Card */}
            <div className="card">
              <h3>📥 Download Backup</h3>
              <p className="muted" style={{ lineHeight: '1.5', margin: '8px 0 16px' }}>
                Create a point-in-time copy of your entire Prime POS database. Keep regular backups safely on an external USB drive or cloud folder.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '10px', background: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem' }}>Full Database (.db) — Recommended</h4>
                  <p className="muted" style={{ fontSize: '0.84rem', margin: '0 0 14px', lineHeight: '1.4' }}>
                    Complete byte-for-byte snapshot of all products, stock history, IMEI serials, customers, invoices, transactions, and settings.
                  </p>
                  <a href="/api/backup/download-db" download className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Database Backup (.db)
                  </a>
                </div>

                <div style={{ padding: '16px', border: '1px solid var(--border)', borderRadius: '10px', background: '#f8fafc' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '0.98rem' }}>Export Data as JSON (.json)</h4>
                  <p className="muted" style={{ fontSize: '0.84rem', margin: '0 0 14px', lineHeight: '1.4' }}>
                    Human-readable JSON export of all shop records, ideal for spreadsheets, audits, and custom reporting.
                  </p>
                  <a href="/api/backup/export-json" download className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Export JSON Data (.json)
                  </a>
                </div>
              </div>
            </div>

            {/* Restore Backup Card */}
            <div className="card">
              <h3>📤 Upload & Restore Backup</h3>
              <p className="muted" style={{ lineHeight: '1.5', margin: '8px 0 16px' }}>
                Restore your Prime POS database from a previously downloaded <strong>.db</strong> or <strong>.json</strong> backup file.
              </p>

              <form onSubmit={handleRestoreSubmit}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontWeight: '600', marginBottom: '6px', color: 'var(--text)' }}>
                    Select Backup File (.db or .json)
                  </label>
                  <input
                    type="file"
                    accept=".db,.sqlite,.json"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    disabled={restoring}
                    style={{ padding: '10px', background: '#f8fafc', cursor: 'pointer' }}
                  />
                  {selectedFile && (
                    <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#2563eb' }}>
                      Selected: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>

                <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#92400e', lineHeight: '1.4' }}>
                    ⚠️ <strong>Warning:</strong> Restoring will overwrite all current sales, products, and customer records with the records from the uploaded backup file.
                  </p>
                </div>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={restoreConfirmed}
                    onChange={e => setRestoreConfirmed(e.target.checked)}
                    style={{ width: 'auto', marginTop: '2px' }}
                    disabled={restoring}
                  />
                  <span>I understand that this will replace my current database records with the backup file.</span>
                </label>

                {restoreStatus && (
                  <div style={{ padding: '8px 12px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>
                    ⏳ {restoreStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!selectedFile || !restoreConfirmed || restoring}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {restoring ? 'Restoring Database...' : 'Restore Database Now'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* LICENSE & SUBSCRIPTION SETTINGS */}
      {tab === 'license' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Machine Identity & Status Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Terminal License & Machine Identity</h3>
              <button className="btn" style={{ fontSize: '0.82rem', padding: '5px 12px' }} onClick={loadLicenseInfo}>
                🔄 Refresh Status
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Hardware Machine Fingerprint (ID)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <code style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {licenseInfo?.machine_id || 'Detecting...'}
                  </code>
                  <button
                    className="btn"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => {
                      if (licenseInfo?.machine_id) {
                        navigator.clipboard.writeText(licenseInfo.machine_id);
                        alert('Machine ID copied to clipboard!');
                      }
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Tied to this POS station's motherboard and CPU
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Current License Status
                </span>
                <div style={{ marginTop: '6px' }}>
                  <span className={`badge ${licenseInfo?.status === 'active' ? 'badge-emerald' : licenseInfo?.status === 'grace_period' ? 'badge-amber' : 'badge-rose'}`} style={{ fontSize: '0.9rem', padding: '4px 12px' }}>
                    {licenseInfo?.status ? licenseInfo.status.toUpperCase() : 'UNLICENSED'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {licenseInfo?.status === 'grace_period'
                    ? `⚠️ Grace period active: ${licenseInfo.graceRemainingDays} day(s) left!`
                    : licenseInfo?.expires_at
                    ? `Valid until ${new Date(licenseInfo.expires_at).toLocaleDateString('en-GB')}`
                    : 'No active commercial license activated'}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.5)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Active Edition & Plan
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '6px', color: 'var(--text)' }}>
                  {licenseInfo?.plan_name ? `${licenseInfo.plan_name} (${licenseInfo.edition || 'Standard'})` : 'Free Evaluation'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {licenseInfo?.remainingDays !== undefined ? `${licenseInfo.remainingDays} day(s) remaining in term` : 'Local Terminal'}
                </div>
              </div>
            </div>

            {/* License details when active */}
            {licenseInfo?.license_key_masked && (
              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>Active License Key:</span>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5', fontSize: '1rem', marginTop: '2px' }}>
                    {licenseInfo.license_key_masked}
                  </div>
                </div>
                <div>
                  <span className="badge" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                    Registered To: {licenseInfo.business_name}
                  </span>
                </div>
              </div>
            )}

            {/* Feature Entitlements */}
            {licenseInfo?.features && (
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  Enabled Feature Modules
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                  {licenseInfo.features.map(f => (
                    <span key={f} className="badge badge-emerald" style={{ fontSize: '0.75rem' }}>
                      ✓ {f.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activate / Replace Key Card */}
          <div className="card">
            <h3>Activate / Update License Key</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 16px 0' }}>
              Purchased a new license, plan upgrade, or renewal from A&M Tech Solutions BD? Enter your 20-character license key below.
            </p>

            <form onSubmit={handleActivateLicense} style={{ display: 'flex', gap: '10px', maxWidth: '640px' }}>
              <input
                type="text"
                placeholder="PRIME-XXXX-XXXX-XXXX-XXXX"
                value={activationKeyInput}
                onChange={e => setActivationKeyInput(e.target.value.toUpperCase())}
                style={{ flex: 1, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.08em', padding: '10px 14px' }}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={activating} style={{ whiteSpace: 'nowrap' }}>
                {activating ? 'Activating...' : 'Activate Terminal'}
              </button>
            </form>
          </div>

          {/* Support & Billing Contact Card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.04) 0%, rgba(6,182,212,0.04) 100%)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: 'var(--primary)' }}>
              Need to Renew or Upgrade your License?
            </h4>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              Contact our official licensing department directly:
              <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontWeight: 600 }}>
                <span>📞 Hotline: <strong>+8801736002401</strong></span>
                <span>🌐 Website: <strong>amtechsolutionsbd.com</strong></span>
                <span>✉️ Email: <strong>licensing@amtechsolutionsbd.com</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Add New User</h2>
              <button className="btn-link" onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <label>
                Username *
                <input
                  required
                  placeholder="e.g. karim"
                  value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                />
              </label>
              <label>
                Password *
                <input
                  type="password"
                  required
                  minLength={4}
                  placeholder="Minimum 4 characters"
                  value={userForm.password}
                  onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                />
              </label>
              <label>
                Full Name
                <input
                  placeholder="e.g. Karim Ahmed"
                  value={userForm.full_name}
                  onChange={e => setUserForm({ ...userForm, full_name: e.target.value })}
                />
              </label>
              <label>
                Role *
                <select
                  value={userForm.role}
                  onChange={e => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="cashier">Cashier / Salesperson</option>
                  <option value="stock_manager">Stock Manager</option>
                  <option value="admin">Admin / Owner</option>
                </select>
              </label>
              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowUserModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
