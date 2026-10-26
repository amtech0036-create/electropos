import React from 'react';

export default function PrintableSubInvoiceModal({ invoiceData, onClose }) {
  if (!invoiceData) return null;
  const { invoice, payments } = invoiceData;

  const fmtBdt = (poisha) => '৳' + ((poisha || 0) / 100).toLocaleString('en-BD', { minimumFractionDigits: 2 });

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: '780px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Subscription Invoice {invoice.invoice_no}</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Issued by A&M Tech Solutions BD</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              🖨️ Print Invoice
            </button>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="printable-canvas" style={{ background: '#ffffff', color: '#0f172a', padding: '32px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #4f46e5', paddingBottom: '20px', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#4f46e5', margin: '0 0 6px 0' }}>
                Prime<span style={{ color: '#06b6d4' }}>POS</span>
              </h1>
              <div style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>A&M Tech Solutions BD</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Dhaka, Bangladesh · Web: amtechsolutionsbd.com</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Support Hotline: +8801736002401 · info@amtechsolutionsbd.com</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>SUBSCRIPTION INVOICE</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#4f46e5', marginTop: '4px' }}>#{invoice.invoice_no}</div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                Date: {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Due Date: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Due upon receipt'}
              </div>
              <div style={{ marginTop: '8px' }}>
                <span className={`badge ${invoice.status === 'paid' ? 'badge-emerald' : invoice.status === 'partially_paid' ? 'badge-amber' : 'badge-rose'}`}>
                  {invoice.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                Billed To (Customer / Business)
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{invoice.business_name}</div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>{invoice.business_address || 'Address on file'}</div>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>Phone: {invoice.business_phone}</div>
              {invoice.business_email && <div style={{ fontSize: '0.85rem', color: '#475569' }}>Email: {invoice.business_email}</div>}
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700, marginBottom: '6px' }}>
                Subscription & Plan Details
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{invoice.plan_name} ({invoice.edition})</div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>
                Period: {invoice.billing_period_start ? new Date(invoice.billing_period_start).toLocaleDateString() : '—'} to {invoice.billing_period_end ? new Date(invoice.billing_period_end).toLocaleDateString() : '—'}
              </div>
              {invoice.license_key_masked && (
                <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#4f46e5', marginTop: '4px' }}>
                  License: {invoice.license_key_masked}
                </div>
              )}
            </div>
          </div>

          {/* Line items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '0.8rem', color: '#475569' }}>Description</th>
                <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '0.8rem', color: '#475569' }}>Billing Cycle</th>
                <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '0.8rem', color: '#475569' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '14px', fontSize: '0.9rem', color: '#0f172a' }}>
                  <strong>Prime POS Subscription: {invoice.plan_name}</strong>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px' }}>
                    Edition: {invoice.edition} · POS, inventory, receipts, customer ledgers, warranty & backup
                  </div>
                </td>
                <td style={{ textAlign: 'center', padding: '14px', fontSize: '0.9rem', color: '#475569' }}>
                  {invoice.billing_interval || 'Annual'}
                </td>
                <td style={{ textAlign: 'right', padding: '14px', fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                  {fmtBdt(invoice.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Totals Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
            <div style={{ width: '280px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>{fmtBdt(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', color: '#10b981' }}>
                  <span>Discount:</span>
                  <span>- {fmtBdt(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', color: '#475569' }}>
                  <span>VAT / Tax:</span>
                  <span>+ {fmtBdt(invoice.tax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #cbd5e1', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                <span>Total Due:</span>
                <span style={{ color: '#4f46e5' }}>{fmtBdt(invoice.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', color: '#10b981' }}>
                <span>Paid to Date:</span>
                <span>{fmtBdt(invoice.paid_amount || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.95rem', fontWeight: 700, color: invoice.due_amount > 0 ? '#ef4444' : '#10b981' }}>
                <span>Balance:</span>
                <span>{fmtBdt(invoice.due_amount || 0)}</span>
              </div>
            </div>
          </div>

          {/* Payment Instructions */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', fontSize: '0.82rem', color: '#475569', marginBottom: '20px' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Official Payment Channels:</div>
            <div>• <strong>bKash Merchant:</strong> 01736002401 (Payment option)</div>
            <div>• <strong>Nagad Merchant:</strong> 01736002401 (Merchant Pay)</div>
            <div>• <strong>Bank Transfer:</strong> Islami Bank Bangladesh PLC / City Bank PLC (Contact support for account)</div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            This is a computer generated subscription invoice from A&M Tech Solutions BD. Thank you for your business.
          </div>
        </div>
      </div>
    </div>
  );
}
