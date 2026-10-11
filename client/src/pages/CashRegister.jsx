import React, { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../App.jsx';

export default function CashRegister() {
  const user = useAuth();
  const [data, setData] = useState({ session: null, breakdown: {}, recent_payments: [], recent_expenses: [] });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('current'); // 'current' | 'history'

  // Open modal state
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openCash, setOpenCash] = useState('1000');
  const [openNotes, setOpenNotes] = useState('');

  // Close modal state
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeCash, setCloseCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [denominations, setDenominations] = useState({ 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0 });
  const [showDenomCalc, setShowDenomCalc] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/api/register/current'),
      api.get('/api/register/sessions?limit=30')
    ]).then(([cur, hist]) => {
      setData(cur);
      setSessions(hist);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Update closeCash whenever denominations change if calculator is active
  function handleDenomChange(note, count) {
    const next = { ...denominations, [note]: Math.max(0, parseInt(count, 10) || 0) };
    setDenominations(next);
    let total = 0;
    for (const [val, qty] of Object.entries(next)) {
      total += parseInt(val, 10) * qty;
    }
    setCloseCash(String(total));
  }

  async function handleOpenSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/api/register/open', {
        opening_cash: parseFloat(openCash) || 0,
        notes: openNotes
      });
      setShowOpenModal(false);
      setOpenNotes('');
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCloseSubmit(e) {
    e.preventDefault();
    const counted = parseFloat(closeCash);
    if (isNaN(counted) || counted < 0) {
      alert('Please enter a valid closing cash amount');
      return;
    }

    if (!confirm('Are you sure you want to close this register session and end your shift?')) {
      return;
    }

    try {
      await api.post('/api/register/close', {
        closing_cash: counted,
        notes: closeNotes
      });
      setShowCloseModal(false);
      setCloseCash('');
      setCloseNotes('');
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const { session, breakdown = {}, recent_payments = [], recent_expenses = [] } = data;
  const isShiftOpen = !!session;
  const countedNum = parseFloat(closeCash) || 0;
  const expectedNum = breakdown.expected_cash || 0;
  const diffNum = countedNum - expectedNum;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Cash Register & Daily Closing</h1>
          <div className="muted">Manage cash drawers, track shift collections, and perform daily reconciliation</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className={`btn ${tab === 'current' ? 'active' : ''}`} onClick={() => setTab('current')}>Active Shift</button>
          <button className={`btn ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>Shift History</button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {tab === 'current' && (
        <>
          {/* Shift Banner */}
          <div className="card" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: isShiftOpen ? '#f0fdf4' : '#f8fafc',
            border: isShiftOpen ? '1px solid #bbf7d0' : '1px solid var(--border)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: isShiftOpen ? '#16a34a' : '#94a3b8'
                }}></span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: isShiftOpen ? '#166534' : '#475569' }}>
                  {isShiftOpen ? `Register Open — Shift in Progress` : 'Register is Currently Closed'}
                </span>
              </div>
              <div className="muted" style={{ marginTop: '4px' }}>
                {isShiftOpen
                  ? `Opened by ${session.full_name || session.username} on ${fmtDate(session.opened_at)} with ${fmtMoney(session.opening_cash)} starting float.`
                  : 'Open the register drawer at the start of your shift to begin recording sales & expenses.'}
              </div>
            </div>

            <div>
              {isShiftOpen ? (
                <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  onClick={() => {
                    setCloseCash(String(breakdown.expected_cash || 0));
                    setShowCloseModal(true);
                  }}>
                  End Shift & Close Drawer
                </button>
              ) : (
                <button className="btn btn-primary" onClick={() => setShowOpenModal(true)}>
                  Start Shift (Open Drawer)
                </button>
              )}
            </div>
          </div>

          {/* If open: KPI breakdown */}
          {isShiftOpen && (
            <>
              <div className="cards">
                <div className="card">
                  <div className="stat-label">Opening Float</div>
                  <div className="stat-value">{fmtMoney(breakdown.opening_cash || 0)}</div>
                  <div className="muted">Starting cash</div>
                </div>
                <div className="card">
                  <div className="stat-label">Cash Sales (+)</div>
                  <div className="stat-value" style={{ color: '#16a34a' }}>+{fmtMoney(breakdown.cash_sales || 0)}</div>
                  <div className="muted">Cash billed at POS</div>
                </div>
                <div className="card">
                  <div className="stat-label">Due Collections (+)</div>
                  <div className="stat-value" style={{ color: '#0284c7' }}>+{fmtMoney(breakdown.cash_collections || 0)}</div>
                  <div className="muted">Customer cash payments</div>
                </div>
                <div className="card">
                  <div className="stat-label">Cash Refunds (-)</div>
                  <div className="stat-value" style={{ color: '#ea580c' }}>-{fmtMoney(breakdown.cash_refunds || 0)}</div>
                  <div className="muted">Returned sales</div>
                </div>
                <div className="card">
                  <div className="stat-label">Cash Expenses (-)</div>
                  <div className="stat-value" style={{ color: '#dc2626' }}>-{fmtMoney(breakdown.cash_expenses || 0)}</div>
                  <div className="muted">Paid from drawer</div>
                </div>
                <div className="card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                  <div className="stat-label" style={{ color: '#1d4ed8' }}>Expected Drawer Cash</div>
                  <div className="stat-value" style={{ color: '#1d4ed8', fontSize: '1.65rem' }}>
                    {fmtMoney(breakdown.expected_cash || 0)}
                  </div>
                  <div className="muted" style={{ color: '#2563eb' }}>Should be in physical drawer</div>
                </div>
              </div>

              {/* Shift reconciliation formula banner */}
              <div className="card" style={{ fontSize: '0.9rem', background: '#f8fafc' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>📐 Real-time Cash Drawer Formula (PRD §14)</div>
                <div style={{ fontFamily: 'monospace', color: '#334155' }}>
                  Opening ({fmtMoney(breakdown.opening_cash)}) + Sales ({fmtMoney(breakdown.cash_sales)}) + Collections ({fmtMoney(breakdown.cash_collections)}) - Refunds ({fmtMoney(breakdown.cash_refunds)}) - Expenses ({fmtMoney(breakdown.cash_expenses)}) = <strong>{fmtMoney(breakdown.expected_cash)}</strong>
                </div>
              </div>

              {/* Transactions in this shift */}
              <div className="two-col">
                <div className="card">
                  <h2>Shift Cash Inflow (Sales & Dues)</h2>
                  <table>
                    <thead>
                      <tr><th>Time</th><th>Reference</th><th>Customer</th><th className="num">Cash In</th></tr>
                    </thead>
                    <tbody>
                      {recent_payments.map(p => (
                        <tr key={p.id}>
                          <td className="muted">{fmtDate(p.created_at)}</td>
                          <td>{p.invoice_no || (p.kind === 'collection' ? 'Due Collection' : 'Payment')}</td>
                          <td>{p.customer_name || 'Walk-in'}</td>
                          <td className="num" style={{ color: p.amount < 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                            {p.amount < 0 ? `-${fmtMoney(Math.abs(p.amount))}` : `+${fmtMoney(p.amount)}`}
                          </td>
                        </tr>
                      ))}
                      {recent_payments.length === 0 && (
                        <tr><td colSpan="4" className="muted">No cash received yet in this shift.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <h2>Shift Cash Outflow (Expenses)</h2>
                  <table>
                    <thead>
                      <tr><th>Time</th><th>Category</th><th>Description</th><th className="num">Paid</th></tr>
                    </thead>
                    <tbody>
                      {recent_expenses.map(e => (
                        <tr key={e.id}>
                          <td className="muted">{fmtDate(e.created_at)}</td>
                          <td><span className="badge badge-draft">{e.category}</span></td>
                          <td>{e.description || '—'}</td>
                          <td className="num" style={{ color: '#dc2626', fontWeight: 600 }}>
                            -{fmtMoney(e.amount)}
                          </td>
                        </tr>
                      ))}
                      {recent_expenses.length === 0 && (
                        <tr><td colSpan="4" className="muted">No cash expenses recorded in this shift.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!isShiftOpen && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔒</div>
              <h2 style={{ marginBottom: '8px' }}>Register Closed</h2>
              <p className="muted" style={{ maxWidth: '420px', margin: '0 auto 20px' }}>
                The physical cash drawer is not currently tied to an active shift. Click below to enter your starting cash float and begin your shift.
              </p>
              <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '1rem' }} onClick={() => setShowOpenModal(true)}>
                Open Register (Start Shift)
              </button>
            </div>
          )}
        </>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="card">
          <h2>Past Shift Closings & Discrepancy Log</h2>
          <table>
            <thead>
              <tr>
                <th>Shift ID</th>
                <th>Cashier</th>
                <th>Opened</th>
                <th>Closed</th>
                <th className="num">Opening Float</th>
                <th className="num">Expected Cash</th>
                <th className="num">Counted Cash</th>
                <th className="num">Discrepancy</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const diff = s.difference || 0;
                return (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td><strong>{s.full_name || s.username}</strong></td>
                    <td className="muted">{fmtDate(s.opened_at)}</td>
                    <td className="muted">{s.closed_at ? fmtDate(s.closed_at) : '— (Active)'}</td>
                    <td className="num">{fmtMoney(s.opening_cash)}</td>
                    <td className="num">{s.expected_cash != null ? fmtMoney(s.expected_cash) : '—'}</td>
                    <td className="num">{s.closing_cash != null ? fmtMoney(s.closing_cash) : '—'}</td>
                    <td className="num">
                      {s.difference == null ? (
                        '—'
                      ) : diff === 0 ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Match (৳0)</span>
                      ) : diff > 0 ? (
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>+{fmtMoney(diff)} Excess</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{fmtMoney(diff)} Shortage</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'open' ? 'badge-draft' : 'badge-completed'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="muted" style={{ maxWidth: '200px' }}>{s.notes || '—'}</td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr><td colSpan="10" className="muted">No register sessions recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Open Register */}
      {showOpenModal && (
        <div className="modal-overlay" onClick={() => setShowOpenModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Open Cash Drawer</h2>
              <button className="btn btn-link" onClick={() => setShowOpenModal(false)}>✕</button>
            </div>
            <form onSubmit={handleOpenSubmit}>
              <label>
                Starting Cash Float (৳)
                <input type="number" min="0" step="any" required autoFocus
                  value={openCash} onChange={e => setOpenCash(e.target.value)} />
              </label>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {[500, 1000, 2000, 5000].map(amt => (
                  <button type="button" key={amt} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                    onClick={() => setOpenCash(String(amt))}>
                    ৳{amt}
                  </button>
                ))}
              </div>

              <label>
                Opening Notes (Optional)
                <input placeholder="e.g. Morning float received from Admin"
                  value={openNotes} onChange={e => setOpenNotes(e.target.value)} />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowOpenModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Start Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Register */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-box modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Daily Closing & End Shift Reconciliation</h2>
              <button className="btn btn-link" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCloseSubmit}>
              <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>System Expected Drawer Balance:</span>
                  <strong style={{ fontSize: '1.25rem', color: '#1d4ed8' }}>{fmtMoney(expectedNum)}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Physical Counted Cash</span>
                <button type="button" className="btn btn-link" onClick={() => setShowDenomCalc(!showDenomCalc)}>
                  {showDenomCalc ? 'Hide Note Calculator ▲' : 'Show Denomination Breakdown ▼'}
                </button>
              </div>

              {showDenomCalc && (
                <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: '#475569' }}>Enter quantity for each note:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    {[1000, 500, 200, 100, 50, 20, 10, 5, 2, 1].map(note => (
                      <label key={note} style={{ margin: 0 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>৳{note} note</span>
                        <input type="number" min="0" style={{ padding: '4px 6px', fontSize: '0.85rem' }}
                          value={denominations[note] || ''}
                          placeholder="0"
                          onChange={e => handleDenomChange(note, e.target.value)} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Total Counted Cash in Drawer (৳)
                <input type="number" min="0" step="any" required autoFocus
                  value={closeCash} onChange={e => setCloseCash(e.target.value)} />
              </label>

              {/* Real-time discrepancy alert */}
              <div style={{
                padding: '12px 14px',
                borderRadius: '8px',
                marginTop: '10px',
                marginBottom: '16px',
                fontWeight: 600,
                background: diffNum === 0 ? '#f0fdf4' : diffNum > 0 ? '#fffbeb' : '#fef2f2',
                color: diffNum === 0 ? '#166534' : diffNum > 0 ? '#b45309' : '#dc2626',
                border: `1px solid ${diffNum === 0 ? '#bbf7d0' : diffNum > 0 ? '#fde68a' : '#fecaca'}`
              }}>
                {diffNum === 0 && '✅ Count matches expected cash exactly.'}
                {diffNum > 0 && `⚠️ Cash Excess: +${fmtMoney(diffNum)} extra in physical drawer.`}
                {diffNum < 0 && `❌ Cash Shortage: -${fmtMoney(Math.abs(diffNum))} missing from physical drawer.`}
              </div>

              <label>
                Closing Notes / Explanation
                <input placeholder="e.g. Change counted and drawer handed over to manager"
                  value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setShowCloseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                  Confirm Daily Closing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
