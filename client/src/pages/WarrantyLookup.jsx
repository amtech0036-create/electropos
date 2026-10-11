import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate } from '../api.js';

export default function WarrantyLookup() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { found, matches }
  const [error, setError] = useState('');

  // Service log form states
  const [logModalUnit, setLogModalUnit] = useState(null);
  const [serviceType, setServiceType] = useState('claim');
  const [serviceNote, setServiceNote] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  async function handleSearch(searchTerm) {
    const term = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!term) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/serials/lookup?q=${encodeURIComponent(term)}`);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddServiceLog(e) {
    e.preventDefault();
    if (!logModalUnit || !serviceNote.trim()) return;
    setSavingLog(true);
    try {
      await api.post(`/api/serials/${logModalUnit.id}/service-logs`, {
        service_type: serviceType,
        note: serviceNote
      });
      setLogModalUnit(null);
      setServiceNote('');
      // Reload current search
      handleSearch();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingLog(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Warranty & Device Lookup</h1>
          <div className="muted">Search any device by IMEI 1, IMEI 2, Serial Number, or Invoice Number to verify warranty status and log service notes (PRD §5, §11.2)</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <form onSubmit={e => { e.preventDefault(); handleSearch(); }} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            autoFocus
            className="search-input"
            style={{ margin: 0, flex: 1 }}
            placeholder="Scan barcode or enter IMEI, Serial Number, or Invoice No…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1rem' }} disabled={loading}>
            {loading ? 'Searching…' : 'Lookup Device'}
          </button>
        </form>

        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: '0.85rem' }}>Quick test IMEIs / Serials:</span>
          {['352849102938471', '359284109283741', '864920194820191', 'PF39XK21001', 'CN08X291001'].map(val => (
            <button key={val} type="button" className="btn" style={{ padding: '3px 8px', fontSize: '0.8rem' }}
              onClick={() => { setQuery(val); handleSearch(val); }}>
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      {data && (
        <div>
          {!data.found && (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🔍</div>
              <h3>No matching device found</h3>
              <p className="muted">No unit found matching "{query}". Please check the IMEI or Serial Number and try again.</p>
            </div>
          )}

          {data.matches?.map(unit => {
            const isSold = unit.status === 'sold';
            const isActive = unit.is_warranty_active;

            return (
              <div key={unit.id} className="card" style={{ marginBottom: '20px', borderLeft: isActive ? '5px solid #16a34a' : (isSold ? '5px solid #dc2626' : '5px solid #3b82f6') }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{unit.product_name}</h2>
                    <div className="muted" style={{ marginTop: '2px' }}>
                      SKU: <strong>{unit.product_sku}</strong> {unit.brand ? ` · Brand: ${unit.brand}` : ''} {unit.model ? ` · Model: ${unit.model}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className={`badge ${unit.status === 'in_stock' ? 'badge-completed' : (unit.status === 'sold' ? 'badge-draft' : 'badge-cancelled')}`}
                      style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                      {unit.status.toUpperCase().replace('_', ' ')}
                    </span>
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      onClick={() => { setLogModalUnit(unit); setServiceType('claim'); setServiceNote(''); }}>
                      ＋ Log Service Note
                    </button>
                  </div>
                </div>

                <div className="two-col" style={{ alignItems: 'start', marginBottom: '16px' }}>
                  {/* Left Column: Device identifiers & Customer info */}
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '0.95rem', margin: '0 0 10px 0', textTransform: 'uppercase', color: '#64748b' }}>Device Identifiers</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '6px', fontSize: '0.92rem' }}>
                      {unit.imei_1 && <><span>IMEI 1:</span><strong style={{ fontFamily: 'monospace' }}>{unit.imei_1}</strong></>}
                      {unit.imei_2 && <><span>IMEI 2:</span><strong style={{ fontFamily: 'monospace' }}>{unit.imei_2}</strong></>}
                      {unit.serial_no && <><span>Serial Number:</span><strong style={{ fontFamily: 'monospace' }}>{unit.serial_no}</strong></>}
                      {unit.notes && <><span>Device Notes:</span><span className="muted">{unit.notes}</span></>}
                    </div>

                    {isSold && (
                      <>
                        <h3 style={{ fontSize: '0.95rem', margin: '14px 0 8px 0', textTransform: 'uppercase', color: '#64748b' }}>Sale & Customer Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '6px', fontSize: '0.92rem' }}>
                          <span>Invoice No:</span>
                          <strong><Link to={`/sales/${unit.sale_id}`}>{unit.invoice_no}</Link></strong>
                          <span>Purchase Date:</span>
                          <span>{fmtDate(unit.sale_date)}</span>
                          <span>Customer:</span>
                          <strong>{unit.customer_name}</strong>
                          {unit.customer_phone && <><span>Phone:</span><span>{unit.customer_phone}</span></>}
                          {unit.customer_address && <><span>Address:</span><span>{unit.customer_address}</span></>}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: Warranty Status Banner */}
                  <div>
                    {isSold ? (
                      <div style={{
                        padding: '16px',
                        borderRadius: '10px',
                        background: isActive ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${isActive ? '#bbf7d0' : '#fecaca'}`,
                        marginBottom: '14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.4rem' }}>{isActive ? '🛡️' : '⚠️'}</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: isActive ? '#166534' : '#991b1b' }}>
                            {isActive ? 'WARRANTY ACTIVE' : 'WARRANTY EXPIRED'}
                          </span>
                        </div>

                        <div style={{ marginTop: '10px', fontSize: '0.95rem', color: isActive ? '#14532d' : '#7f1d1d' }}>
                          <div>Coverage Period: <strong>{unit.warranty_months || 12} Months Manufacturer Warranty</strong></div>
                          <div>Start Date: <strong>{fmtDate(unit.warranty_start_date)}</strong></div>
                          <div>Expiry Date: <strong>{fmtDate(unit.warranty_end_date)}</strong></div>
                          <div style={{ marginTop: '8px', fontWeight: 700 }}>
                            {isActive
                              ? `✓ ${unit.days_remaining} days of warranty remaining`
                              : `✕ Expired ${Math.abs(unit.days_remaining)} days ago`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '16px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', marginBottom: '14px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1d4ed8' }}>📦 In-Stock Inventory Unit</div>
                        <p className="muted" style={{ margin: '6px 0 0 0', color: '#2563eb' }}>
                          This unit has not been sold yet. Its {unit.warranty_months || 12}-month warranty coverage will activate automatically on the sale date.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Service & Repair History */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Service & Repair Claim History ({unit.service_logs?.length || 0})</h3>
                  {unit.service_logs && unit.service_logs.length > 0 ? (
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Logged By</th><th>Type</th><th>Service Details / Diagnosis</th></tr>
                      </thead>
                      <tbody>
                        {unit.service_logs.map(log => (
                          <tr key={log.id}>
                            <td className="muted">{fmtDate(log.created_at)}</td>
                            <td><strong>{log.username}</strong></td>
                            <td><span className="badge badge-draft">{log.service_type.toUpperCase()}</span></td>
                            <td>{log.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="muted" style={{ fontStyle: 'italic', padding: '6px 0' }}>No service claims or repair notes recorded for this unit.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Log Service Note */}
      {logModalUnit && (
        <div className="modal-overlay" onClick={() => setLogModalUnit(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Log Service Note — {logModalUnit.product_name}</h2>
              <button className="btn btn-link" onClick={() => setLogModalUnit(null)}>✕</button>
            </div>
            <form onSubmit={handleAddServiceLog}>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '12px', fontSize: '0.9rem' }}>
                <div>Device: <strong>{logModalUnit.imei_1 ? `IMEI: ${logModalUnit.imei_1}` : `SN: ${logModalUnit.serial_no}`}</strong></div>
                {logModalUnit.customer_name && <div>Customer: <strong>{logModalUnit.customer_name}</strong></div>}
              </div>

              <label>
                Service / Claim Type
                <select value={serviceType} onChange={e => setServiceType(e.target.value)}>
                  <option value="claim">Warranty Claim Inspection</option>
                  <option value="repair">Sent for Authorized Repair</option>
                  <option value="replacement">Device Replaced / Exchanged</option>
                  <option value="note">General Technical Note</option>
                </select>
              </label>

              <label>
                Diagnosis & Service Notes
                <textarea
                  required
                  rows="4"
                  style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                  placeholder="e.g. Customer reported loose charging port. Sent to Samsung Authorized Service Center with Job Sheet #482."
                  value={serviceNote}
                  onChange={e => setServiceNote(e.target.value)}
                />
              </label>

              <div className="modal-foot">
                <button type="button" className="btn" onClick={() => setLogModalUnit(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingLog}>
                  {savingLog ? 'Saving…' : 'Record Service Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
