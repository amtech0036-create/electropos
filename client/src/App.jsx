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

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
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

  return (
    <AuthCtx.Provider value={user}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">Prime<span>POS</span></div>
          <nav>
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/pos" className="new-sale">＋ New Sale</NavLink>
            <NavLink to="/sales">Sales & Returns</NavLink>
            <NavLink to="/warranty">Warranty & IMEI</NavLink>
            <NavLink to="/products">Products</NavLink>
            <NavLink to="/customers">Customers</NavLink>
            <NavLink to="/expenses">Expenses</NavLink>
            <NavLink to="/register">Cash Register</NavLink>
            {canPurchases && (
              <>
                <NavLink to="/purchases">Purchases</NavLink>
                <NavLink to="/suppliers">Suppliers</NavLink>
                <NavLink to="/stock">Stock</NavLink>
              </>
            )}
            {isAdmin && <NavLink to="/settings">Settings</NavLink>}
          </nav>
          <div className="sidebar-footer">
            <div className="user-chip">{user.full_name || user.username} <small>({user.role})</small></div>
            <button className="btn btn-link" onClick={async () => { await api.post('/api/auth/logout'); setUser(null); }}>
              Log out
            </button>
          </div>
        </aside>
        <main className="content">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthCtx.Provider>
  );
}
