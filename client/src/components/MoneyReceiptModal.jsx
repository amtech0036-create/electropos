import React from 'react';
import { fmtMoney, fmtDate, fmtOrdinalDate } from '../api.js';

export default function MoneyReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;
  const s = receipt.settings || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-wide" onClick={e => e.stopPropagation()} style={{ background: '#f8fafc' }}>
        <div className="no-print modal-head">
          <h2>🧾 Payment Money Receipt</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Print Receipt
            </button>
            <button type="button" className="btn-link" onClick={onClose} style={{ fontSize: '1.2rem' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Card */}
        <div className="money-receipt-card">
          <div className="money-receipt-header">
            <h2 style={{ margin: '0 0 4px', fontSize: '1.35rem', color: '#0f172a' }}>
              {s.shop_name || 'Prime POS'}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              {s.shop_address}{s.shop_phone ? ` · Tel: ${s.shop_phone}` : ''}
            </div>
            <div className="money-receipt-title">Money Receipt</div>
          </div>

          <div className="money-receipt-grid">
            <div>
              <span style={{ color: '#64748b' }}>Receipt No:</span>{' '}
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{receipt.receipt_no}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#64748b' }}>Date:</span>{' '}
              <strong>{fmtDate(receipt.created_at)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Customer:</span>{' '}
              <strong>{receipt.customer_name}</strong>
              {receipt.customer_phone ? ` (${receipt.customer_phone})` : ''}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#64748b' }}>Received By:</span>{' '}
              <strong>{receipt.cashier_name}</strong>
            </div>
          </div>

          <div className="money-receipt-box">
            <div className="money-receipt-row">
              <span style={{ color: '#475569' }}>Previous Balance Due:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(receipt.previous_due)}</span>
            </div>

            <div className="money-receipt-row highlight">
              <span>Amount Paid ({receipt.method.toUpperCase()}):</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtMoney(receipt.amount_paid)}</span>
            </div>

            <div className="money-receipt-row" style={{ fontWeight: 700 }}>
              <span>Remaining Balance Due:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: receipt.new_due > 0 ? '#dc2626' : '#15803d' }}>
                {fmtMoney(receipt.new_due)}
              </span>
            </div>

            {receipt.notes && (
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                Note: {receipt.notes}
              </div>
            )}
          </div>

          {/* Next Installment or Full Settlement Status */}
          {receipt.new_due <= 0 ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '10px 14px',
              textAlign: 'center',
              color: '#15803d',
              fontWeight: 700,
              fontSize: '0.92rem',
              margin: '12px 0'
            }}>
              ✓ FULLY SETTLED — All due balances and installments are completely cleared!
            </div>
          ) : (
            receipt.next_installment && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.88rem',
                color: '#1e3a8a',
                margin: '12px 0'
              }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
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
              Customer Signature
            </div>
            <div className="money-receipt-sign-line">
              Authorized Signature
            </div>
          </div>
        </div>

        <div className="no-print modal-foot">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            🖨️ Print Receipt
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
