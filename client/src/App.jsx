import React, { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POS from './pages/POS.jsx';
import Products from './pages/Products.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Invoice from './pages/Invoice.jsx';
import Customers from './pages/Customers.jsx';
import Purchases from './pages/Purchases.jsx';
import Suppliers from './pages/Suppliers.jsx';
import Expenses from './pages/Expenses.jsx';
import Stock from './pages/Stock.jsx';
import Settings from './pages/Settings.jsx';
import CashRegister from './pages/CashRegister.jsx';
import WarrantyLookup from './pages/WarrantyLookup.jsx';
import LicensingHub from './pages/Licensing/LicensingHub.jsx';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState(null);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(u => {
        setUser(u);
        return api.get('/api/license/status');
      })
      .then(setLicenseStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Intercept F12 and DevTools shortcuts triggered by barcode scanners or accidental presses
  useEffect(() => {
    const handleDevToolsShortcuts = (e) => {
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        return;
      }
    };

    window.addEventListener('keydown', handleDevToolsShortcuts, true);
    return () => window.removeEventListener('keydown', handleDevToolsShortcuts, true);
  }, []);

  if (loading) return <div className="loading">Loading…</div>;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const canPurchases = user.role === 'admin' || user.role === 'stock_manager';
  const isAdmin = user.role === 'admin';
  const isSuperAdmin = user.is_super_admin === 1 || user.role === 'admin';

  return (
    <AuthCtx.Provider value={user}>
      <div className="app">
        {/* Ambient floating glowing blobs for glassmorphic refraction */}
        <div className="ambient-blobs" aria-hidden="true">
          <div className="blob blob-purple"></div>
          <div className="blob blob-cyan"></div>
          <div className="blob blob-pink"></div>
          <div className="blob blob-emerald"></div>
        </div>

        <aside className="sidebar">
          <div className="brand">
            <div className="brand-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
            </div>
            <span>Prime<span className="brand-accent">POS</span></span>
          </div>
          <nav>
            <NavLink to="/" end>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/pos" className="new-sale">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              <span>New Sale</span>
            </NavLink>
            <NavLink to="/sales">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              <span>Sales & Returns</span>
            </NavLink>
            <NavLink to="/warranty">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              <span>Warranty & IMEI</span>
            </NavLink>
            <NavLink to="/products">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <span>Products</span>
            </NavLink>
            <NavLink to="/customers">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>Customers</span>
            </NavLink>
            <NavLink to="/expenses">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
              <span>Expenses</span>
            </NavLink>
            <NavLink to="/register">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              <span>Cash Register</span>
            </NavLink>
            {canPurchases && (
              <>
                <NavLink to="/purchases">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                  <span>Purchases</span>
                </NavLink>
                <NavLink to="/suppliers">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                  <span>Suppliers</span>
                </NavLink>
                <NavLink to="/stock">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  <span>Stock</span>
                </NavLink>
              </>
            )}
            {isAdmin && (
              <NavLink to="/settings">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                <span>Settings</span>
              </NavLink>
            )}
            {isSuperAdmin && (
              <NavLink to="/licensing">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Licensing & Plans</span>
              </NavLink>
            )}
          </nav>
          <div className="sidebar-footer">
            <div className="user-card">
              <div className="user-avatar">{user.full_name ? user.full_name[0].toUpperCase() : user.username[0].toUpperCase()}</div>
              <div className="user-meta">
                <div className="user-name">{user.full_name || user.username}</div>
                <div className="user-role">{user.role.replace('_', ' ')}</div>
              </div>
            </div>
            <button className="btn-logout" onClick={async () => { await api.post('/api/auth/logout'); setUser(null); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              Log out
            </button>
          </div>
        </aside>
        <main className="content">
          {/* Global License Expiry / Grace Period Warning Banner */}
          {licenseStatus && (licenseStatus.status === 'grace_period' || licenseStatus.status === 'expired' || (licenseStatus.status === 'active' && licenseStatus.remainingDays <= 7)) && (
            <div style={{
              background: licenseStatus.status === 'expired' ? '#fee2e2' : licenseStatus.status === 'grace_period' ? '#fef3c7' : '#e0e7ff',
              color: licenseStatus.status === 'expired' ? '#991b1b' : licenseStatus.status === 'grace_period' ? '#92400e' : '#3730a3',
              border: `1px solid ${licenseStatus.status === 'expired' ? '#fca5a5' : licenseStatus.status === 'grace_period' ? '#fcd34d' : '#c7d2fe'}`,
              padding: '10px 18px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: '0.88rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{licenseStatus.status === 'expired' ? '⛔' : '⚠️'}</span>
                <span>
                  {licenseStatus.status === 'expired'
                    ? 'Your Prime POS commercial license has expired. Cash register checkout is restricted to read-only. Please renew with A&M Tech Solutions BD.'
                    : licenseStatus.status === 'grace_period'
                    ? `Subscription Term Expired — Grace period active (${licenseStatus.graceRemainingDays} day(s) remaining). Renew soon to avoid checkout interruption.`
                    : `Subscription Notice: License term expires in ${licenseStatus.remainingDays} day(s) on ${new Date(licenseStatus.expires_at).toLocaleDateString()}.`}
                </span>
              </div>
              <NavLink to="/settings" style={{ background: 'currentColor', color: '#ffffff', padding: '4px 10px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.78rem' }}>
                <span style={{ color: licenseStatus.status === 'expired' ? '#991b1b' : licenseStatus.status === 'grace_period' ? '#92400e' : '#3730a3', filter: 'invert(1)' }}>Renew License</span>
              </NavLink>
            </div>
          )}

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/sales" element={<SalesHistory />} />
            <Route path="/sales/:id" element={<Invoice />} />
            <Route path="/sales/:id/print" element={<Invoice />} />
            <Route path="/warranty" element={<WarrantyLookup />} />
            <Route path="/products" element={<Products />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/register" element={<CashRegister />} />
            {canPurchases && (
              <>
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/stock" element={<Stock />} />
              </>
            )}
            {isAdmin && <Route path="/settings" element={<Settings />} />}
            {isSuperAdmin && <Route path="/licensing/*" element={<LicensingHub />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthCtx.Provider>
  );
}
