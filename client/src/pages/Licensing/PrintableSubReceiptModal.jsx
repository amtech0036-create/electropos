import React from 'react';

export default function PrintableSubReceiptModal({ payment, onClose }) {
  if (!payment) return null;

  const fmtBdt = (poisha) => '৳' + ((poisha || 0) / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 });

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '650px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Payment Receipt #{payment.receipt_no}</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Official Verification Record</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Print Receipt
            </button>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Paper Receipt Canvas */}
        <div className="printable-canvas" style={{ background: '#ffffff', color: '#0f172a', padding: '28px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', borderBottom: '2px dashed #cbd5e1', paddingBottom: '18px', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5', margin: '0 0 4px 0' }}>
              Prime<span style={{ color: '#06b6d4' }}>POS</span>
            </h2>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>A&M Tech Solutions BD</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Dhaka, Bangladesh · Web: amtechsolutionsbd.com</div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Support: +8801736002401 · info@amtechsolutionsbd.com</div>
            
            <div style={{ marginTop: '12px', display: 'inline-block', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '4px 14px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem' }}>
              ✓ OFFICIAL PAYMENT RECEIPT
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '0.88rem' }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Receipt Number:</span>
              <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{payment.receipt_no}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Payment Date:</span>
              <div style={{ fontWeight: 600 }}>{new Date(payment.payment_date || payment.created_at).toLocaleString('en-GB')}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Customer / Business:</span>
              <div style={{ fontWeight: 700 }}>{payment.business_name}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Linked Invoice:</span>
              <div style={{ fontWeight: 600 }}>{payment.invoice_no || 'Direct License Deposit'}</div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Payment Method:</span>
              <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{payment.method || payment.payment_method}</span>
            </div>
            {payment.transaction_ref && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>Transaction ID / Ref:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{payment.transaction_ref}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Verification Status:</span>
              <span style={{ fontWeight: 700, color: payment.status === 'verified' ? '#10b981' : '#f59e0b' }}>
                {payment.status === 'verified' ? 'VERIFIED' : 'PENDING APPROVAL'}
              </span>
            </div>
            {payment.verified_by_name && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Verified By:</span>
                <span style={{ fontWeight: 600 }}>{payment.verified_by_name}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '2px solid #0f172a', paddingTop: '12px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Total Amount Received:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{fmtBdt(payment.amount)}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
            A&M Tech Solutions BD — Powering modern retail and retail chains across Bangladesh.
          </div>
        </div>
      </div>
    </div>
  );
}
