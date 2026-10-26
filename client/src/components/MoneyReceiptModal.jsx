import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api, fmtMoney, fmtDate, fmtOrdinalDate } from '../api.js';

export default function MoneyReceiptModal({ receipt, onClose }) {
  const [mode, setMode] = useState('a4'); // 'a4' | 'thermal'
  const [shopSettings, setShopSettings] = useState(receipt?.settings || {});

  useEffect(() => {
    document.body.classList.add('has-money-receipt-modal');
    // Ensure fresh shop settings (Uttara Computers, address, phone, website)
    api.get('/api/settings').then(res => {
      if (res && typeof res === 'object' && res.shop_name) {
        setShopSettings(res);
      }
    }).catch(() => {});

    return () => {
      document.body.classList.remove('has-money-receipt-modal');
    };
  }, [receipt]);

  if (!receipt) return null;
  const s = { ...(shopSettings || {}), ...(receipt?.settings || {}) };

  return createPortal(
    <div id="money-receipt-portal" className="money-receipt-portal">
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-box modal-wide"
          onClick={e => e.stopPropagation()}
          style={{ background: '#f8fafc' }}
        >
          {/* Non-printable modal header with view mode toggle */}
          <div className="no-print modal-head">
            <div>
              <h2>🧾 Payment Money Receipt</h2>
              <div className="muted" style={{ fontSize: '0.82rem', marginTop: '2px' }}>
                Receipt #{receipt.receipt_no} · {receipt.customer_name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="btn-row" style={{ marginRight: '4px' }}>
                <button
                  type="button"
                  className={`btn ${mode === 'a4' ? 'active' : ''}`}
                  onClick={() => setMode('a4')}
                  style={{ fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  📄 Voucher Slip (A4)
                </button>
                <button
                  type="button"
                  className={`btn ${mode === 'thermal' ? 'active' : ''}`}
                  onClick={() => setMode('thermal')}
                  style={{ fontSize: '0.84rem', padding: '6px 12px' }}
                >
                  🧾 80mm Thermal
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ padding: '6px 16px' }}
              >
                🖨️ Print Receipt
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={onClose}
                style={{ fontSize: '1.25rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          </div>

          {mode === 'a4' ? (
            /* ============================================================
               Standard A4 Voucher Slip
               ============================================================ */
            <div className="money-receipt-card">
              <div className="money-receipt-header">
                <h2 style={{ margin: '0 0 4px', fontSize: '1.45rem', color: '#0f172a', fontWeight: 800 }}>
                  {s.shop_name || 'Uttara Computers'}
                </h2>
                <div style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.4 }}>
                  {s.shop_address || 'Shop 64, 3rd Floor BNS Center Uttara Dhaka 1230'}
                  {(s.shop_phone || '01743383764') ? ` · Tel: ${s.shop_phone || '01743383764'}` : ''}
                  {(s.shop_website || 'https://uttaracomputer.com') ? ` · ${s.shop_website || 'https://uttaracomputer.com'}` : ''}
                </div>
                <div className="money-receipt-title">
                  MONEY RECEIPT / PAYMENT VOUCHER
                </div>
              </div>

              <div className="money-receipt-grid">
                <div>
                  <span style={{ color: '#64748b' }}>Receipt No:</span>{' '}
                  <strong style={{ fontFamily: 'var(--font-mono)', color: '#0f172a' }}>{receipt.receipt_no}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>Date & Time:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{fmtDate(receipt.created_at)}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Received From:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{receipt.customer_name}</strong>
                  {receipt.customer_phone ? ` (${receipt.customer_phone})` : ''}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: '#64748b' }}>Collected By:</span>{' '}
                  <strong style={{ color: '#0f172a' }}>{receipt.cashier_name || 'Authorized Cashier'}</strong>
                </div>
              </div>

              <div className="money-receipt-box">
                <div className="money-receipt-row">
                  <span style={{ color: '#475569' }}>Previous Balance Due:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtMoney(receipt.previous_due)}</span>
                </div>

                <div className="money-receipt-row highlight">
                  <span>Amount Paid ({receipt.method ? receipt.method.toUpperCase() : 'CASH'}):</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(receipt.amount_paid)}</span>
                </div>

                <div className="money-receipt-row" style={{ fontWeight: 700 }}>
                  <span>Remaining Balance Due:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: receipt.new_due > 0 ? '#dc2626' : '#15803d', fontSize: '1.05rem' }}>
                    {fmtMoney(receipt.new_due)}
                  </span>
                </div>

                {receipt.notes && (
                  <div style={{ fontSize: '0.84rem', color: '#475569', marginTop: '6px', borderTop: '1px dashed #cbd5e1', paddingTop: '6px' }}>
                    <strong>Note / Remarks:</strong> {receipt.notes}
                  </div>
                )}
              </div>

              {/* Next Installment or Full Settlement Status */}
              {receipt.new_due <= 0 ? (
                <div style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  textAlign: 'center',
                  color: '#15803d',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  margin: '14px 0'
                }}>
                  ✓ ACCOUNT FULLY SETTLED — All due balances and installments are completely cleared!
                </div>
              ) : (
                receipt.next_installment && (
                  <div style={{
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '0.9rem',
                    color: '#1e3a8a',
                    margin: '14px 0'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '3px' }}>
                      📅 Next Installment Schedule:
                    </div>
                    <div>
                      Next Due Date:{' '}
                      <strong style={{ color: '#1d4ed8' }}>
                        {fmtOrdinalDate(receipt.next_installment.date)}
                      </strong>
                      {receipt.next_installment.amount && (
                        <span> · Expected Amount: <strong>{fmtMoney(receipt.next_installment.amount)}</strong> ({receipt.next_installment.frequency})</span>
                      )}
                    </div>
                  </div>
                )
              )}

              <div className="money-receipt-signatures">
                <div className="money-receipt-sign-line">
                  Customer / Payer Signature
                </div>
                <div className="money-receipt-sign-line">
                  Authorized Seal & Signature
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#64748b', marginTop: '14px' }}>
                Thank you for your payment! • Computer-generated official money receipt.
              </div>

              {/* Agency Branding Footer 1 inch above */}
              <div className="inv-dev-footer">
                <span>For Custom Software & Website — </span>
                <a href="https://amtechsolutionsbd.com" target="_blank" rel="noopener noreferrer">
                  Amtechsolutionsbd.com
                </a>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>Phone: 01736002401</span>
              </div>
            </div>
          ) : (
            /* ============================================================
               80mm POS Thermal Receipt Slip
               ============================================================ */
            <div className="money-receipt-thermal">
              <div className="th-center">
                <h3 style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 800 }}>
                  {s.shop_name || 'Uttara Computers'}
                </h3>
                <div>{s.shop_address || 'Shop 64, 3rd Floor BNS Center Uttara Dhaka 1230'}</div>
                <div>Tel: {s.shop_phone || '01743383764'}</div>
                <div>{s.shop_website || 'https://uttaracomputer.com'}</div>
              </div>
              <div className="th-sep">--------------------------------</div>
              <div className="th-center" style={{ fontWeight: 700, letterSpacing: '0.05em' }}>
                *** MONEY RECEIPT ***
              </div>
              <div className="th-sep">--------------------------------</div>
              <div>Receipt No : {receipt.receipt_no}</div>
              <div>Date       : {fmtDate(receipt.created_at)}</div>
              <div>Customer   : {receipt.customer_name}</div>
              {receipt.customer_phone && <div>Phone      : {receipt.customer_phone}</div>}
              <div>Cashier    : {receipt.cashier_name || 'Cashier'}</div>
              <div className="th-sep">--------------------------------</div>
              <div className="th-row">
                <span>PREVIOUS DUE:</span>
                <span>{fmtMoney(receipt.previous_due)}</span>
              </div>
              <div className="th-row th-total">
                <span>PAID ({receipt.method ? receipt.method.toUpperCase() : 'CASH'}):</span>
                <span>{fmtMoney(receipt.amount_paid)}</span>
              </div>
              <div className="th-row" style={{ fontWeight: 700 }}>
                <span>REMAINING DUE:</span>
                <span>{fmtMoney(receipt.new_due)}</span>
              </div>
              {receipt.notes && (
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  Note: {receipt.notes}
                </div>
              )}
              <div className="th-sep">--------------------------------</div>
              {receipt.new_due <= 0 ? (
                <div className="th-center" style={{ fontWeight: 700 }}>
                  *** ALL DUES SETTLED ***
                </div>
              ) : (
                receipt.next_installment && (
                  <div>
                    <div style={{ fontWeight: 700 }}>NEXT INSTALLMENT:</div>
                    <div>Date: {fmtOrdinalDate(receipt.next_installment.date)}</div>
                    {receipt.next_installment.amount && (
                      <div>Amount: {fmtMoney(receipt.next_installment.amount)} ({receipt.next_installment.frequency})</div>
                    )}
                  </div>
                )
              )}
              <div className="th-sep">--------------------------------</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', fontSize: '11px' }}>
                <div style={{ borderTop: '1px dashed #64748b', width: '110px', textAlign: 'center', paddingTop: '3px' }}>
                  Customer
                </div>
                <div style={{ borderTop: '1px dashed #64748b', width: '110px', textAlign: 'center', paddingTop: '3px' }}>
                  Authorized
                </div>
              </div>
              <div className="th-center" style={{ marginTop: '14px', fontSize: '11px' }}>
                Thank you for your payment!
              </div>

              {/* Thermal Agency Branding 1 inch above */}
              <div style={{ marginTop: '0.8in' }}>
                <div className="th-sep">--------------------------------</div>
                <div className="th-center" style={{ fontSize: '11px', color: '#475569' }}>
                  <div>For Custom Software & Website:</div>
                  <strong style={{ letterSpacing: '0.04em' }}>Amtechsolutionsbd.com</strong>
                  <div>Phone: 01736002401</div>
                </div>
              </div>
            </div>
          )}

          {/* Non-printable modal footer */}
          <div className="no-print modal-foot">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => window.print()}
            >
              🖨️ Print Receipt
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

