import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import PrintableSubInvoiceModal from './PrintableSubInvoiceModal.jsx';
import PrintableSubReceiptModal from './PrintableSubReceiptModal.jsx';

export default function LicensingHub() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Data states
  const [dashboardData, setDashboardData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [devices, setDevices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({
    code: '', name: '', edition: 'Standard', billing_interval: 'monthly',
    duration_days: 30, price_bdt: 1000, max_users: 2, max_devices: 1, max_branches: 1,
    enabled_features: ['pos', 'sales', 'inventory', 'customers', 'receipts'],
    support_tier: 'Standard', active: 1
  });

  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [bizForm, setBizForm] = useState({
    business_name: '', owner_name: '', phone: '', email: '', address: '', trade_license_no: '', notes: ''
  });

  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueForm, setIssueForm] = useState({
    business_id: '', plan_id: '', custom_duration_days: '', notes: ''
  });
  const [issuedResult, setIssuedResult] = useState(null); // Displays raw activation key once

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewForm, setRenewForm] = useState({ license_id: '', additional_days: 30, notes: '' });

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invForm, setInvForm] = useState({
    business_id: '', license_id: '', plan_id: '', billing_period_start: '', billing_period_end: '',
    amount_bdt: 1000, discount_bdt: 0, tax_bdt: 0, due_date: '', notes: ''
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payForm, setPayForm] = useState({
    invoice_id: '', amount_bdt: '', payment_method: 'bkash', transaction_ref: '', notes: ''
  });

  // Printable modals
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState(null);
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState(null);

  const fmtBdt = (poisha) => '৳' + ((poisha || 0) / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 });

  function loadDashboard() {
    setLoading(true);
    api.get('/api/licensing/dashboard')
      .then(setDashboardData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  function loadPlans() {
    api.get('/api/licensing/plans').then(setPlans).catch(e => setError(e.message));
  }

  function loadBusinesses() {
    api.get('/api/licensing/businesses').then(setBusinesses).catch(e => setError(e.message));
  }

  function loadLicenses() {
    api.get('/api/licensing/licenses').then(setLicenses).catch(e => setError(e.message));
  }

  function loadInvoices() {
    api.get('/api/licensing/invoices').then(setInvoices).catch(e => setError(e.message));
  }

  function loadPayments() {
    api.get('/api/licensing/payments').then(setPayments).catch(e => setError(e.message));
  }

  function loadDevices() {
    api.get('/api/licensing/devices').then(setDevices).catch(e => setError(e.message));
  }

  function loadNotifications() {
    api.get('/api/licensing/notifications').then(setNotifications).catch(e => setError(e.message));
  }

  function loadAudit() {
    api.get('/api/licensing/audit').then(setAuditLogs).catch(e => setError(e.message));
  }

  useEffect(() => {
    if (activeTab === 'dashboard') loadDashboard();
    if (activeTab === 'plans') loadPlans();
    if (activeTab === 'businesses') loadBusinesses();
    if (activeTab === 'licenses' || activeTab === 'renewals') {
      loadLicenses();
      loadBusinesses();
      loadPlans();
    }
    if (activeTab === 'invoices') {
      loadInvoices();
      loadBusinesses();
      loadPlans();
      loadLicenses();
    }
    if (activeTab === 'payments') {
      loadPayments();
      loadInvoices();
    }
    if (activeTab === 'devices') loadDevices();
    if (activeTab === 'notifications') loadNotifications();
    if (activeTab === 'audit') loadAudit();
  }, [activeTab]);

  // Actions
  async function handleCreatePlan(e) {
    e.preventDefault();
    try {
      await api.post('/api/licensing/plans', planForm);
      setSuccess('Plan created successfully');
      setShowPlanModal(false);
      loadPlans();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRegisterBusiness(e) {
    e.preventDefault();
    try {
      await api.post('/api/licensing/businesses', bizForm);
      setSuccess('Business registered successfully');
      setShowBusinessModal(false);
      loadBusinesses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleIssueLicense(e) {
    e.preventDefault();
    try {
      const res = await api.post('/api/licensing/licenses/issue', issueForm);
      setIssuedResult(res);
      setSuccess('License generated successfully! Please copy the activation key below.');
      loadLicenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRenewLicense(e) {
    e.preventDefault();
    try {
      await api.post(`/api/licensing/licenses/${renewForm.license_id}/renew`, renewForm);
      setSuccess('License renewed successfully');
      setShowRenewModal(false);
      loadLicenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSuspendLicense(id) {
    const reason = prompt('Enter reason for suspension:');
    if (!reason) return;
    try {
      await api.post(`/api/licensing/licenses/${id}/suspend`, { reason });
      setSuccess('License suspended');
      loadLicenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReactivateLicense(id) {
    if (!confirm('Reactivate this license?')) return;
    try {
      await api.post(`/api/licensing/licenses/${id}/reactivate`);
      setSuccess('License reactivated');
      loadLicenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevokeLicense(id) {
    const reason = prompt('WARNING: Revocation is permanent. Enter justification:');
    if (!reason) return;
    try {
      await api.post(`/api/licensing/licenses/${id}/revoke`, { reason });
      setSuccess('License revoked permanently');
      loadLicenses();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateInvoice(e) {
    e.preventDefault();
    try {
      await api.post('/api/licensing/invoices', invForm);
      setSuccess('Subscription invoice generated');
      setShowInvoiceModal(false);
      loadInvoices();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRecordPayment(e) {
    e.preventDefault();
    try {
      await api.post('/api/licensing/payments', payForm);
      setSuccess('Payment recorded successfully (pending verification)');
      setShowPaymentModal(false);
      loadPayments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleVerifyPayment(id) {
    if (!confirm('Verify this payment? This will update invoice balances and activate/extend licenses.')) return;
    try {
      await api.post(`/api/licensing/payments/${id}/verify`);
      setSuccess('Payment verified successfully!');
      loadPayments();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeactivateDevice(id) {
    if (!confirm('Deactivate this registered device terminal?')) return;
    try {
      await api.post(`/api/licensing/devices/${id}/deactivate`);
      setSuccess('Device terminal deactivated');
      loadDevices();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApproveDevice(id) {
    try {
      await api.post(`/api/licensing/devices/${id}/approve-replacement`);
      setSuccess('Device terminal approved');
      loadDevices();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRunExpiryCheck() {
    try {
      const res = await api.post('/api/licensing/notifications/run-check');
      setSuccess(`Expiry check run complete. Processed notifications.`);
      loadNotifications();
    } catch (err) {
      setError(err.message);
    }
  }

  async function openPrintInvoice(invId) {
    try {
      const data = await api.get(`/api/licensing/invoices/${invId}`);
      setSelectedInvoiceForPrint(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="licensing-hub-page" style={{ paddingBottom: '60px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem' }}>🔐</span> Prime POS License & Subscription Manager
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            A&M Tech Solutions BD Super Admin Control Panel · Local & Cloud License Lifecycle Management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={handleRunExpiryCheck} title="Check expiry triggers and create notifications">
            🔄 Check Expiry
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <span>✓ {success}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        {[
          { id: 'dashboard', label: '📊 Dashboard Overview' },
          { id: 'plans', label: '📦 Plans & Features' },
          { id: 'businesses', label: '🏢 Client Accounts' },
          { id: 'licenses', label: '🔑 Issued Licenses' },
          { id: 'invoices', label: '🧾 Subscription Invoices' },
          { id: 'payments', label: '💳 Payment Verification' },
          { id: 'renewals', label: '⏳ Expiry & Renewals' },
          { id: 'devices', label: '💻 Registered Terminals' },
          { id: 'notifications', label: '🔔 Expiry Alerts' },
          { id: 'audit', label: '📜 Audit Trail' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSearchTerm(''); }}
            className={`btn ${activeTab === t.id ? 'btn-primary' : ''}`}
            style={{ fontSize: '0.86rem', padding: '7px 14px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* 1. DASHBOARD VIEW */}
      {/* ============================================================ */}
      {activeTab === 'dashboard' && dashboardData && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Active Subscriptions</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-emerald)', marginTop: '4px' }}>
                {dashboardData.metrics.activeLicenses}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Out of {dashboardData.metrics.totalLicenses} total licenses
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Expiring in 7 Days</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: dashboardData.metrics.expiringSoon > 0 ? 'var(--warn)' : 'var(--text)', marginTop: '4px' }}>
                {dashboardData.metrics.expiringSoon}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Needs renewal notice
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Verified Revenue</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                {fmtBdt(dashboardData.metrics.totalRevenue)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Across all verified subscription payments
              </div>
            </div>

            <div className="card" style={{ padding: '18px' }}>
              <div style={{ color: 'var(--muted)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Client Businesses</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>
                {dashboardData.metrics.totalBusinesses}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {dashboardData.metrics.pendingPayments} payments awaiting verification
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Recent Expiry Reminders</h3>
                <button className="btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => setActiveTab('notifications')}>View All</button>
              </div>
              {dashboardData.recentNotifications?.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No recent expiry reminders logged.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dashboardData.recentNotifications.map(n => (
                    <div key={n.id} style={{ background: 'rgba(255,255,255,0.4)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ color: 'var(--primary)' }}>{n.trigger_type.replace(/_/g, ' ').toUpperCase()}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(n.sent_at).toLocaleString()}</span>
                      </div>
                      <div style={{ marginTop: '3px', color: 'var(--text)' }}>{n.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Recent Administrative Audit</h3>
                <button className="btn" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => setActiveTab('audit')}>View All</button>
              </div>
              {dashboardData.recentAudit?.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>No recent audit activity.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dashboardData.recentAudit.map(a => (
                    <div key={a.id} style={{ background: 'rgba(255,255,255,0.4)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.84rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>{a.action}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{new Date(a.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        By <strong>{a.actor_name || a.username || 'System'}</strong> on {a.entity_type} #{a.entity_id}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. PLANS VIEW */}
      {/* ============================================================ */}
      {activeTab === 'plans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Configured Subscription Plans</h2>
            <button className="btn btn-primary" onClick={() => setShowPlanModal(true)}>
              + Add New Plan
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {plans.map(p => (
              <div key={p.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem' }}>{p.name}</h3>
                      <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)' }}>{p.edition}</span>
                    </div>
                    <span className={`badge ${p.active ? 'badge-emerald' : 'badge-rose'}`}>
                      {p.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>

                  <div style={{ margin: '16px 0', fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                    {fmtBdt(p.price)}
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}> / {p.billing_interval}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '16px' }}>
                    <div>👥 <strong>Max Users:</strong> {p.max_users}</div>
                    <div>💻 <strong>Terminals:</strong> {p.max_devices} PC(s)</div>
                    <div>🏬 <strong>Branches:</strong> {p.max_branches}</div>
                    <div>🛠️ <strong>Support Tier:</strong> {p.support_tier}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, marginBottom: '6px' }}>
                      Enabled Features
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {p.enabled_features?.map(f => (
                        <span key={f} style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button className="btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }} onClick={() => {
                    setIssueForm(prev => ({ ...prev, plan_id: p.id }));
                    setShowIssueModal(true);
                  }}>
                    Issue License
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CLIENT BUSINESSES */}
      {/* ============================================================ */}
      {activeTab === 'businesses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Registered Businesses</h2>
              <input
                type="text"
                placeholder="Search business or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', width: '240px' }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setShowBusinessModal(true)}>
              + Register Business
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Business Name</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Owner</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Address</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Licenses</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.filter(b => !searchTerm || b.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.phone?.includes(searchTerm)).map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{b.business_name}</td>
                    <td style={{ padding: '12px 16px' }}>{b.owner_name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{b.phone}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{b.address || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge" style={{ background: '#f1f5f9' }}>{b.license_count || 0}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${b.status === 'active' ? 'badge-emerald' : 'badge-rose'}`}>{b.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => {
                        setIssueForm({ business_id: b.id, plan_id: '', custom_duration_days: '', notes: '' });
                        setShowIssueModal(true);
                      }}>
                        + Issue License
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. LICENSES & ISSUANCE */}
      {/* ============================================================ */}
      {activeTab === 'licenses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Licenses & Activations</h2>
              <input
                type="text"
                placeholder="Search business or key..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', width: '240px' }}
              />
            </div>
            <button className="btn btn-primary" onClick={() => {
              setIssueForm({ business_id: '', plan_id: '', custom_duration_days: '', notes: '' });
              setShowIssueModal(true);
            }}>
              + Issue New License Key
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>License Key</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Customer / Business</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Plan</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Expires</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Terminals</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {licenses.filter(l => !searchTerm || l.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) || l.license_key_masked?.includes(searchTerm)).map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                      {l.license_key_masked}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{l.business_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.business_phone}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div>{l.plan_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{l.edition} · {l.billing_interval}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {l.expires_at ? new Date(l.expires_at).toLocaleDateString('en-GB') : 'Permanent'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className="badge" style={{ background: '#f1f5f9' }}>
                        {l.active_device_count || 0} / {l.max_devices}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${l.status === 'active' ? 'badge-emerald' : l.status === 'grace_period' ? 'badge-amber' : l.status === 'suspended' ? 'badge-rose' : 'badge-slate'}`}>
                        {l.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => {
                          setRenewForm({ license_id: l.id, additional_days: 30, notes: '' });
                          setShowRenewModal(true);
                        }}>
                          Renew
                        </button>
                        {l.status === 'active' ? (
                          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--warn)' }} onClick={() => handleSuspendLicense(l.id)}>
                            Suspend
                          </button>
                        ) : l.status === 'suspended' ? (
                          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--accent-emerald)' }} onClick={() => handleReactivateLicense(l.id)}>
                            Reactivate
                          </button>
                        ) : null}
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }} onClick={() => handleRevokeLicense(l.id)}>
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. SUBSCRIPTION INVOICES */}
      {/* ============================================================ */}
      {activeTab === 'invoices' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Subscription Invoices</h2>
            <button className="btn btn-primary" onClick={() => setShowInvoiceModal(true)}>
              + Create Subscription Invoice
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Invoice No</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Business</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Plan</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Total Amount</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Paid</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Balance Due</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(i => (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                      {i.invoice_no}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{i.business_name}</td>
                    <td style={{ padding: '12px 16px' }}>{i.plan_name}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{fmtBdt(i.total)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--accent-emerald)' }}>{fmtBdt(i.paid_amount || 0)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: i.due_amount > 0 ? 'var(--danger)' : 'var(--accent-emerald)', fontWeight: 700 }}>
                      {fmtBdt(i.due_amount || 0)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${i.status === 'paid' ? 'badge-emerald' : i.status === 'partially_paid' ? 'badge-amber' : 'badge-rose'}`}>
                        {i.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => openPrintInvoice(i.id)}>
                          🖨️ Print
                        </button>
                        {i.due_amount > 0 && (
                          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => {
                            setPayForm({ invoice_id: i.id, amount_bdt: (i.due_amount || 0) / 100, payment_method: 'bkash', transaction_ref: '', notes: '' });
                            setShowPaymentModal(true);
                          }}>
                            Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. PAYMENTS & VERIFICATION */}
      {/* ============================================================ */}
      {activeTab === 'payments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Payment Transactions & Verification</h2>
            <button className="btn btn-primary" onClick={() => setShowPaymentModal(true)}>
              + Record Payment
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Receipt No</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Customer / Business</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Invoice</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Method</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Trx ID</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Amount</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>{p.receipt_no}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.business_name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--muted)' }}>{p.invoice_no || '—'}</td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase', fontWeight: 600 }}>{p.method}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{p.transaction_ref || '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                      {fmtBdt(p.amount)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${p.status === 'verified' ? 'badge-emerald' : 'badge-amber'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setSelectedPaymentForPrint(p)}>
                          🖨️ Receipt
                        </button>
                        {p.status !== 'verified' && (
                          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleVerifyPayment(p.id)}>
                            ✓ Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. EXPIRY & RENEWALS REPORT */}
      {/* ============================================================ */}
      {activeTab === 'renewals' && (
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>Renewals & Expiry Reports</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Customer</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Phone</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Plan</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Expiration Date</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Days Remaining</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(l => {
                  const now = new Date();
                  const exp = l.expires_at ? new Date(l.expires_at) : null;
                  const days = exp ? Math.ceil((exp.getTime() - now.getTime()) / (24 * 3600 * 1000)) : 9999;
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{l.business_name}</td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{l.business_phone}</td>
                      <td style={{ padding: '12px 16px' }}>{l.plan_name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {exp ? exp.toLocaleDateString('en-GB') : 'Permanent'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: days <= 7 ? 'var(--danger)' : days <= 30 ? 'var(--warn)' : 'var(--accent-emerald)' }}>
                        {exp ? `${days} day(s)` : 'Unlimited'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`badge ${l.status === 'active' ? 'badge-emerald' : 'badge-amber'}`}>{l.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => {
                          setRenewForm({ license_id: l.id, additional_days: 30, notes: '' });
                          setShowRenewModal(true);
                        }}>
                          Renew Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. REGISTERED TERMINALS / DEVICES */}
      {/* ============================================================ */}
      {activeTab === 'devices' && (
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>Registered POS Machine Terminals</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Terminal Name</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Business</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Hardware ID</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>License Key</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Registered At</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.device_name}</td>
                    <td style={{ padding: '12px 16px' }}>{d.business_name}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{d.device_id}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{d.license_key_masked}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                      {new Date(d.registered_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${d.status === 'active' ? 'badge-emerald' : 'badge-slate'}`}>{d.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {d.status === 'active' ? (
                        <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }} onClick={() => handleDeactivateDevice(d.id)}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => handleApproveDevice(d.id)}>
                          Re-approve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 9. NOTIFICATIONS VIEW */}
      {/* ============================================================ */}
      {activeTab === 'notifications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Automated Expiry Alerts & Notices</h2>
            <button className="btn btn-primary" onClick={handleRunExpiryCheck}>
              ⚡ Run Expiry Check Now
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Business</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Trigger Type</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Channel</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Message</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Date</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{n.business_name}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                      {n.trigger_type.replace(/_/g, ' ').toUpperCase()}
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'uppercase' }}>{n.channel}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>{n.message}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--muted)' }}>
                      {new Date(n.sent_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${n.status === 'sent' ? 'badge-emerald' : 'badge-rose'}`}>{n.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 10. AUDIT TRAIL */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (
        <div>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>Immutable Administrative Audit Trail</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(241,245,249,0.7)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Timestamp</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Actor</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Action</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Target</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a.actor_name || a.username || 'System'}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{a.action}</td>
                    <td style={{ padding: '12px 16px' }}>{a.entity_type} #{a.entity_id}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {a.details ? JSON.stringify(a.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ADD PLAN */}
      {/* ============================================================ */}
      {showPlanModal && (
        <div className="modal-backdrop" onClick={() => setShowPlanModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
            <h2>Create New Subscription Plan</h2>
            <form onSubmit={handleCreatePlan} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
              <label>
                Plan Code (Slug) *
                <input required placeholder="e.g. pro-retail-annual" value={planForm.code} onChange={e => setPlanForm({ ...planForm, code: e.target.value })} />
              </label>
              <label>
                Display Name *
                <input required placeholder="e.g. Professional Retail" value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} />
              </label>
              <label>
                Edition
                <select value={planForm.edition} onChange={e => setPlanForm({ ...planForm, edition: e.target.value })}>
                  <option value="Standard">Standard</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </label>
              <label>
                Billing Interval
                <select value={planForm.billing_interval} onChange={e => setPlanForm({ ...planForm, billing_interval: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </label>
              <label>
                Price in BDT *
                <input required type="number" value={planForm.price_bdt} onChange={e => setPlanForm({ ...planForm, price_bdt: e.target.value })} />
              </label>
              <label>
                Duration (Days)
                <input type="number" value={planForm.duration_days} onChange={e => setPlanForm({ ...planForm, duration_days: e.target.value })} />
              </label>
              <label>
                Max Users
                <input type="number" value={planForm.max_users} onChange={e => setPlanForm({ ...planForm, max_users: e.target.value })} />
              </label>
              <label>
                Max Terminals (Devices)
                <input type="number" value={planForm.max_devices} onChange={e => setPlanForm({ ...planForm, max_devices: e.target.value })} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Plan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: REGISTER BUSINESS */}
      {/* ============================================================ */}
      {showBusinessModal && (
        <div className="modal-backdrop" onClick={() => setShowBusinessModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
            <h2>Register Client Business Account</h2>
            <form onSubmit={handleRegisterBusiness} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
              <label style={{ gridColumn: '1 / -1' }}>
                Business / Shop Name *
                <input required placeholder="e.g. Uttara Computers" value={bizForm.business_name} onChange={e => setBizForm({ ...bizForm, business_name: e.target.value })} />
              </label>
              <label>
                Owner / Manager Name
                <input placeholder="e.g. Karim Ullah" value={bizForm.owner_name} onChange={e => setBizForm({ ...bizForm, owner_name: e.target.value })} />
              </label>
              <label>
                Phone Number *
                <input required placeholder="e.g. 01711223344" value={bizForm.phone} onChange={e => setBizForm({ ...bizForm, phone: e.target.value })} />
              </label>
              <label>
                Email
                <input type="email" placeholder="shop@example.com" value={bizForm.email} onChange={e => setBizForm({ ...bizForm, email: e.target.value })} />
              </label>
              <label>
                Trade License No
                <input placeholder="e.g. TR-998822" value={bizForm.trade_license_no} onChange={e => setBizForm({ ...bizForm, trade_license_no: e.target.value })} />
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Shop Physical Address
                <input placeholder="e.g. Shop 64, 3rd Floor, BNS Center, Uttara" value={bizForm.address} onChange={e => setBizForm({ ...bizForm, address: e.target.value })} />
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowBusinessModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Register Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ISSUE LICENSE */}
      {/* ============================================================ */}
      {showIssueModal && (
        <div className="modal-backdrop" onClick={() => { setShowIssueModal(false); setIssuedResult(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
            <h2>Issue New Activation Key</h2>
            
            {issuedResult ? (
              <div style={{ marginTop: '20px' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ color: '#065f46', fontWeight: 700, marginBottom: '6px' }}>
                    ✓ License Key Generated Successfully!
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#047857', marginBottom: '12px' }}>
                    Send this raw activation key to the client. For maximum security, this plaintext key is shown only once and only its SHA-256 hash is saved.
                  </div>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '6px', border: '1px solid #6ee7b7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                      {issuedResult.activationKey}
                    </code>
                    <button className="btn btn-primary" style={{ padding: '6px 12px' }} onClick={() => {
                      navigator.clipboard.writeText(issuedResult.activationKey);
                      alert('Activation key copied to clipboard!');
                    }}>
                      Copy Key
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                  <div>🏢 <strong>Business:</strong> {issuedResult.businessName}</div>
                  <div>📦 <strong>Plan:</strong> {issuedResult.planName}</div>
                  <div>⏳ <strong>Expires:</strong> {new Date(issuedResult.expiresAt).toLocaleDateString()}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={() => { setShowIssueModal(false); setIssuedResult(null); }}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleIssueLicense} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginTop: '16px' }}>
                <label>
                  Select Business Account *
                  <select required value={issueForm.business_id} onChange={e => setIssueForm({ ...issueForm, business_id: e.target.value })}>
                    <option value="">-- Choose Business --</option>
                    {businesses.map(b => (
                      <option key={b.id} value={b.id}>{b.business_name} ({b.phone})</option>
                    ))}
                  </select>
                </label>

                <label>
                  Select Subscription Plan *
                  <select required value={issueForm.plan_id} onChange={e => setIssueForm({ ...issueForm, plan_id: e.target.value })}>
                    <option value="">-- Choose Plan --</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.edition}) - {fmtBdt(p.price)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Custom Duration in Days (Optional)
                  <input type="number" placeholder="Leave empty for plan default" value={issueForm.custom_duration_days} onChange={e => setIssueForm({ ...issueForm, custom_duration_days: e.target.value })} />
                </label>

                <label>
                  Issuance Notes
                  <input placeholder="e.g. 1 Year renewal for Counter 1" value={issueForm.notes} onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })} />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn" onClick={() => setShowIssueModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Generate Activation Key</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: RENEW LICENSE */}
      {/* ============================================================ */}
      {showRenewModal && (
        <div className="modal-backdrop" onClick={() => setShowRenewModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
            <h2>Renew Subscription License</h2>
            <form onSubmit={handleRenewLicense} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginTop: '16px' }}>
              <label>
                Extension Duration in Days *
                <input required type="number" value={renewForm.additional_days} onChange={e => setRenewForm({ ...renewForm, additional_days: e.target.value })} />
              </label>

              <label>
                Renewal Notes
                <input placeholder="e.g. Bank payment received for 2027 extension" value={renewForm.notes} onChange={e => setRenewForm({ ...renewForm, notes: e.target.value })} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowRenewModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Extend Validity</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CREATE SUBSCRIPTION INVOICE */}
      {/* ============================================================ */}
      {showInvoiceModal && (
        <div className="modal-backdrop" onClick={() => setShowInvoiceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', width: '90%' }}>
            <h2>Create Subscription Billing Invoice</h2>
            <form onSubmit={handleCreateInvoice} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
              <label style={{ gridColumn: '1 / -1' }}>
                Customer / Business *
                <select required value={invForm.business_id} onChange={e => setInvForm({ ...invForm, business_id: e.target.value })}>
                  <option value="">-- Choose Business --</option>
                  {businesses.map(b => (
                    <option key={b.id} value={b.id}>{b.business_name} ({b.phone})</option>
                  ))}
                </select>
              </label>

              <label>
                Plan *
                <select required value={invForm.plan_id} onChange={e => {
                  const sel = plans.find(p => String(p.id) === e.target.value);
                  setInvForm({
                    ...invForm,
                    plan_id: e.target.value,
                    amount_bdt: sel ? sel.price / 100 : invForm.amount_bdt
                  });
                }}>
                  <option value="">-- Choose Plan --</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} - {fmtBdt(p.price)}</option>
                  ))}
                </select>
              </label>

              <label>
                Amount in BDT *
                <input required type="number" value={invForm.amount_bdt} onChange={e => setInvForm({ ...invForm, amount_bdt: e.target.value })} />
              </label>

              <label>
                Period Start
                <input type="date" value={invForm.billing_period_start} onChange={e => setInvForm({ ...invForm, billing_period_start: e.target.value })} />
              </label>

              <label>
                Period End
                <input type="date" value={invForm.billing_period_end} onChange={e => setInvForm({ ...invForm, billing_period_end: e.target.value })} />
              </label>

              <label>
                Discount (BDT)
                <input type="number" value={invForm.discount_bdt} onChange={e => setInvForm({ ...invForm, discount_bdt: e.target.value })} />
              </label>

              <label>
                Due Date
                <input type="date" value={invForm.due_date} onChange={e => setInvForm({ ...invForm, due_date: e.target.value })} />
              </label>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowInvoiceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ============================================================ */}
      {showPaymentModal && (
        <div className="modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', width: '90%' }}>
            <h2>Record Subscription Payment</h2>
            <form onSubmit={handleRecordPayment} className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginTop: '16px' }}>
              <label>
                Select Invoice *
                <select required value={payForm.invoice_id} onChange={e => {
                  const inv = invoices.find(i => String(i.id) === e.target.value);
                  setPayForm({
                    ...payForm,
                    invoice_id: e.target.value,
                    amount_bdt: inv ? (inv.due_amount || inv.total) / 100 : payForm.amount_bdt
                  });
                }}>
                  <option value="">-- Select Unpaid Invoice --</option>
                  {invoices.filter(i => i.status !== 'paid').map(i => (
                    <option key={i.id} value={i.id}>{i.invoice_no} — {i.business_name} (Due: {fmtBdt(i.due_amount)})</option>
                  ))}
                </select>
              </label>

              <label>
                Amount (BDT) *
                <input required type="number" value={payForm.amount_bdt} onChange={e => setPayForm({ ...payForm, amount_bdt: e.target.value })} />
              </label>

              <label>
                Payment Method *
                <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="cash">Cash</option>
                </select>
              </label>

              <label>
                Transaction Ref / TrxID
                <input placeholder="e.g. 9JA882X7Q" value={payForm.transaction_ref} onChange={e => setPayForm({ ...payForm, transaction_ref: e.target.value })} />
              </label>

              <label>
                Payment Notes
                <input placeholder="e.g. bKash payment from 01711223344" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE MODALS */}
      {selectedInvoiceForPrint && (
        <PrintableSubInvoiceModal invoiceData={selectedInvoiceForPrint} onClose={() => setSelectedInvoiceForPrint(null)} />
      )}

      {selectedPaymentForPrint && (
        <PrintableSubReceiptModal payment={selectedPaymentForPrint} onClose={() => setSelectedPaymentForPrint(null)} />
      )}
    </div>
  );
}
