import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtMoney, fmtDate } from '../api.js';

export default function Invoice() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('a4'); // 'a4' | 'thermal'

  useEffect(() => { api.get(`/api/sales/${id}`).then(setSale).catch(e => setError(e.message)); }, [id]);

  useEffect(() => {
    if (mode === 'print') return;
    const css = document.getElementById('invoice-print-css');
    if (css) css.disabled = mode !== 'thermal';
  }, [mode]);

  if (error) return <div className="error">{error}</div>;
  if (!sale) return <div className="loading">Loading…</div>;

  const s = sale.settings || {};

  return (
    <div>
      <div className="no-print page-head">
        <h1>Invoice {sale.invoice_no}</h1>
        <div className="btn-row">
          <button className={`btn ${mode === 'a4' ? 'active' : ''}`} onClick={() => setMode('a4')}>A4 View</button>
          <button className={`btn ${mode === 'thermal' ? 'active' : ''}`} onClick={() => setMode('thermal')}>80mm Thermal</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
          <Link to="/sales" className="btn">Back</Link>
        </div>
      </div>

      {mode === 'a4' ? (
        <div className="invoice-a4">
          <div className="inv-head">
            <div>
              <h2>{s.shop_name}</h2>
              <div className="muted">{s.shop_address}{s.shop_phone ? ` · ${s.shop_phone}` : ''}</div>
            </div>
            <div className="inv-meta">
              <div><strong>{sale.invoice_no}</strong></div>
              <div className="muted">{fmtDate(sale.created_at)}</div>
            </div>
          </div>
          <div className="inv-customer">
            <div><span className="muted">Bill to</span><br /><strong>{sale.customer_name}</strong>{sale.customer_phone ? ` · ${sale.customer_phone}` : ''}</div>
            <div><span className="muted">Sold by</span><br />{sale.cashier_name}</div>
          </div>
          <table className="inv-table">
            <thead><tr><th>#</th><th>Product Details</th><th>SKU</th><th className="num">Qty</th><th className="num">Unit</th><th className="num">Disc</th><th className="num">Total</th></tr></thead>
            <tbody>
              {sale.items.map((i, idx) => (
                <tr key={i.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{i.product_name}</strong>
                    {i.serials && i.serials.length > 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '3px', background: '#f8fafc', padding: '3px 6px', borderRadius: '4px' }}>
                        {i.serials.map((sr, si) => (
                          <div key={si}>
                            📱 {sr.imei_1 ? `IMEI: ${sr.imei_1} ` : ''}{sr.imei_2 ? `(IMEI2: ${sr.imei_2}) ` : ''}{sr.serial_no ? `SN: ${sr.serial_no}` : ''}
                            {sr.warranty_end_date && <span style={{ color: '#16a34a', marginLeft: '6px' }}>• Warranty until {fmtDate(sr.warranty_end_date)}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (i.serial_info && (
                      <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>{i.serial_info}</div>
                    ))}
                  </td>
                  <td>{i.product_sku}</td>
                  <td className="num">{i.qty}</td><td className="num">{fmtMoney(i.unit_price)}</td>
                  <td className="num">{i.discount > 0 ? fmtMoney(i.discount) : '—'}</td>
                  <td className="num">{fmtMoney(i.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="inv-totals">
            <div><span>Subtotal</span><span>{fmtMoney(sale.subtotal)}</span></div>
            {sale.invoice_discount > 0 && <div><span>Discount</span><span>−{fmtMoney(sale.invoice_discount)}</span></div>}
            {sale.tax_amount > 0 && <div><span>Tax/VAT</span><span>{fmtMoney(sale.tax_amount)}</span></div>}
            <div className="grand"><span>Total</span><span>{fmtMoney(sale.total)}</span></div>
            <div><span>Paid</span><span>{fmtMoney(sale.paid)}</span></div>
            {sale.due > 0 && <div><span>Due</span><span className="warn">{fmtMoney(sale.due)}</span></div>}
            {sale.change_given > 0 && <div><span>Change</span><span>{fmtMoney(sale.change_given)}</span></div>}
            <div><span>Payment method</span><span>{sale.payments.map(p => p.method).join(', ') || '—'}</span></div>
          </div>
          {s.warranty_terms && (
            <div className="inv-terms muted">
              <strong>Warranty & Return Policy:</strong>
              <div>{s.warranty_terms}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="invoice-thermal">
          <div className="th-center">
            <h3>{s.shop_name}</h3>
            <div>{s.shop_address}</div>
            <div>{s.shop_phone}</div>
          </div>
          <div className="th-sep">--------------------------------</div>
          <div>Invoice: {sale.invoice_no}</div>
          <div>Date: {fmtDate(sale.created_at)}</div>
          <div>Customer: {sale.customer_name}</div>
          <div className="th-sep">--------------------------------</div>
          {sale.items.map(i => (
            <div key={i.id} className="th-line">
              <div style={{ fontWeight: 'bold' }}>{i.product_name}</div>
              {i.serials && i.serials.length > 0 && (
                <div style={{ fontSize: '11px' }}>
                  {i.serials.map((sr, si) => (
                    <div key={si}>
                      {sr.imei_1 ? `IMEI:${sr.imei_1} ` : ''}{sr.serial_no ? `SN:${sr.serial_no}` : ''}
                      {sr.warranty_end_date && ` (War:${fmtDate(sr.warranty_end_date)})`}
                    </div>
                  ))}
                </div>
              )}
              <div>{i.qty} x {fmtMoney(i.unit_price)}{i.discount > 0 ? ` (-${fmtMoney(i.discount)})` : ''} = {fmtMoney(i.line_total)}</div>
            </div>
          ))}
          <div className="th-sep">--------------------------------</div>
          <div className="th-total">TOTAL: {fmtMoney(sale.total)}</div>
          <div>Paid: {fmtMoney(sale.paid)}</div>
          {sale.due > 0 && <div>DUE: {fmtMoney(sale.due)}</div>}
          {sale.change_given > 0 && <div>Change: {fmtMoney(sale.change_given)}</div>}
          <div>Method: {sale.payments.map(p => p.method).join(', ')}</div>
          <div className="th-sep">--------------------------------</div>
          <div className="th-center">{s.warranty_terms || ''}</div>
          <div className="th-center" style={{ marginTop: '6px' }}>Thank you for your business!</div>
        </div>
      )}
    </div>
  );
}
