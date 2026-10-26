import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireSuperAdmin } from '../auth.js';
import {
  issueLicense,
  activateLicense,
  getLicenseStatus,
  renewLicense,
  suspendLicense,
  reactivateLicense,
  revokeLicense,
  createSubscriptionInvoice,
  recordSubscriptionPayment,
  verifySubscriptionPayment,
  logAudit
} from '../services/licenseService.js';
import { checkExpiryAndNotify } from '../middleware/licenseGuard.js';

export const licensingRouter = Router();

// ==========================================
// 1. PUBLIC / LOCAL CLIENT LICENSE ENDPOINTS
// ==========================================

// Get current system license status and machine fingerprint
licensingRouter.get('/status', (req, res) => {
  try {
    const status = getLicenseStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate license on this local installation
licensingRouter.post('/activate', (req, res) => {
  const key = req.body.license_key || req.body.activation_key || req.body.key;
  if (!key) {
    return res.status(400).json({ error: 'License key is required' });
  }

  try {
    const result = activateLicense({
      activationKey: String(key).trim(),
      deviceName: req.body.device_label || req.body.device_name || 'Main Terminal POS',
      ipAddress: req.ip
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. SUPER ADMIN MANAGEMENT ENDPOINTS
// ==========================================

// Protect all following routes with requireAuth & requireSuperAdmin
licensingRouter.use(requireAuth);
licensingRouter.use(requireSuperAdmin);

// Dashboard Overview Metrics
licensingRouter.get('/dashboard', (req, res) => {
  try {
    const totalBusinesses = db.prepare(`SELECT COUNT(*) AS c FROM sub_businesses WHERE status = 'active'`).get().c;
    const totalLicenses = db.prepare(`SELECT COUNT(*) AS c FROM sub_licenses`).get().c;
    const activeLicenses = db.prepare(`SELECT COUNT(*) AS c FROM sub_licenses WHERE status = 'active'`).get().c;
    const suspendedLicenses = db.prepare(`SELECT COUNT(*) AS c FROM sub_licenses WHERE status = 'suspended'`).get().c;
    const expiredLicenses = db.prepare(`SELECT COUNT(*) AS c FROM sub_licenses WHERE status = 'expired'`).get().c;
    
    // Expiring within 7 days
    const expiringSoon = db.prepare(`
      SELECT COUNT(*) AS c FROM sub_licenses 
      WHERE status = 'active' 
        AND expires_at IS NOT NULL 
        AND expires_at > datetime('now') 
        AND expires_at <= datetime('now', '+7 days')
    `).get().c;

    // Total verified revenue in poisha
    const revenueRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_revenue 
      FROM sub_payments 
      WHERE status = 'verified'
    `).get();

    // Pending payments count
    const pendingPayments = db.prepare(`
      SELECT COUNT(*) AS c FROM sub_payments WHERE status = 'pending'
    `).get().c;

    // Recent notifications
    const recentNotifications = db.prepare(`
      SELECT * FROM sub_notifications ORDER BY sent_at DESC LIMIT 5
    `).all();

    // Recent audit logs
    const recentAudit = db.prepare(`
      SELECT a.*, u.username, u.full_name 
      FROM sub_audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT 8
    `).all();

    res.json({
      metrics: {
        totalBusinesses,
        totalLicenses,
        activeLicenses,
        suspendedLicenses,
        expiredLicenses,
        expiringSoon,
        totalRevenue: revenueRow.total_revenue,
        pendingPayments
      },
      recentNotifications,
      recentAudit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// Plans API
// ------------------------------------------
licensingRouter.get('/plans', (req, res) => {
  try {
    const plans = db.prepare(`SELECT * FROM sub_plans ORDER BY price ASC`).all();
    res.json(plans.map(p => ({
      ...p,
      enabled_features: JSON.parse(p.enabled_features || '[]')
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/plans', (req, res) => {
  const {
    code, name, edition, billing_interval, duration_days, price_bdt,
    max_users, max_devices, max_branches, enabled_features, support_tier, active
  } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Plan code and name are required' });
  }

  const priceMinor = Math.round(Number(price_bdt || 0) * 100);

  try {
    const stmt = db.prepare(`
      INSERT INTO sub_plans (
        code, name, edition, billing_interval, duration_days, price,
        max_users, max_devices, max_branches, enabled_features, support_tier, active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      code.trim().toLowerCase(),
      name.trim(),
      edition || 'Standard',
      billing_interval || 'monthly',
      duration_days ? Number(duration_days) : 30,
      priceMinor,
      Number(max_users || 1),
      Number(max_devices || 1),
      Number(max_branches || 1),
      JSON.stringify(enabled_features || ['pos', 'sales']),
      support_tier || 'Standard',
      active !== undefined ? (active ? 1 : 0) : 1
    );

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'plan.create',
      entityType: 'plan',
      entityId: result.lastInsertRowid,
      details: { code, name, priceMinor },
      ipAddress: req.ip
    });

    res.json({ id: result.lastInsertRowid, message: 'Plan created successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

licensingRouter.put('/plans/:id', (req, res) => {
  const planId = req.params.id;
  const {
    name, edition, billing_interval, duration_days, price_bdt,
    max_users, max_devices, max_branches, enabled_features, support_tier, active
  } = req.body;

  try {
    const priceMinor = Math.round(Number(price_bdt || 0) * 100);
    db.prepare(`
      UPDATE sub_plans
      SET name = ?, edition = ?, billing_interval = ?, duration_days = ?, price = ?,
          max_users = ?, max_devices = ?, max_branches = ?, enabled_features = ?, support_tier = ?,
          active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name,
      edition || 'Standard',
      billing_interval || 'monthly',
      duration_days ? Number(duration_days) : 30,
      priceMinor,
      Number(max_users || 1),
      Number(max_devices || 1),
      Number(max_branches || 1),
      JSON.stringify(enabled_features || []),
      support_tier || 'Standard',
      active !== undefined ? (active ? 1 : 0) : 1,
      planId
    );

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'plan.update',
      entityType: 'plan',
      entityId: planId,
      details: { name, priceMinor },
      ipAddress: req.ip
    });

    res.json({ message: 'Plan updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Businesses / Accounts API
// ------------------------------------------
licensingRouter.get('/businesses', (req, res) => {
  try {
    const businesses = db.prepare(`
      SELECT b.*, 
        (SELECT COUNT(*) FROM sub_licenses l WHERE l.business_id = b.id) AS license_count
      FROM sub_businesses b 
      ORDER BY b.created_at DESC
    `).all();
    res.json(businesses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/businesses', (req, res) => {
  const {
    business_name, owner_name, phone, email, address, trade_license_no, notes
  } = req.body;

  if (!business_name || !phone) {
    return res.status(400).json({ error: 'Business name and phone are required' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO sub_businesses (
        business_name, owner_name, phone, email, address, trade_license_no, notes, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
    `);

    const result = stmt.run(
      business_name.trim(),
      (owner_name || '').trim(),
      phone.trim(),
      (email || '').trim(),
      (address || '').trim(),
      (trade_license_no || '').trim(),
      (notes || '').trim()
    );

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'business.create',
      entityType: 'business',
      entityId: result.lastInsertRowid,
      details: { business_name, phone },
      ipAddress: req.ip
    });

    res.json({ id: result.lastInsertRowid, message: 'Business registered successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

licensingRouter.put('/businesses/:id', (req, res) => {
  const { id } = req.params;
  const { business_name, owner_name, phone, email, address, trade_license_no, notes, status } = req.body;

  try {
    db.prepare(`
      UPDATE sub_businesses
      SET business_name = ?, owner_name = ?, phone = ?, email = ?, address = ?,
          trade_license_no = ?, notes = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      business_name,
      owner_name,
      phone,
      email,
      address,
      trade_license_no,
      notes,
      status || 'active',
      id
    );

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'business.update',
      entityType: 'business',
      entityId: id,
      details: { business_name, phone, status },
      ipAddress: req.ip
    });

    res.json({ message: 'Business updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Licenses API
// ------------------------------------------
licensingRouter.get('/licenses', (req, res) => {
  try {
    const licenses = db.prepare(`
      SELECT l.*, b.business_name, b.phone AS business_phone, p.name AS plan_name, p.edition, p.billing_interval,
        (SELECT COUNT(*) FROM sub_devices d WHERE d.license_id = l.id AND d.status = 'active') AS active_device_count
      FROM sub_licenses l
      JOIN sub_businesses b ON b.id = l.business_id
      JOIN sub_plans p ON p.id = l.plan_id
      ORDER BY l.issued_at DESC
    `).all();

    res.json(licenses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Issue a new license
licensingRouter.post('/licenses/issue', (req, res) => {
  const { business_id, plan_id, notes, custom_duration_days } = req.body;
  if (!business_id || !plan_id) {
    return res.status(400).json({ error: 'business_id and plan_id are required' });
  }

  try {
    const issued = issueLicense({
      businessId: Number(business_id),
      planId: Number(plan_id),
      createdBy: req.user.id,
      actorName: req.user.full_name || req.user.username,
      notes,
      customDurationDays: custom_duration_days ? Number(custom_duration_days) : null
    });

    res.json(issued);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Renew License
licensingRouter.post('/licenses/:id/renew', (req, res) => {
  const { id } = req.params;
  const { additional_days, new_plan_id, notes } = req.body;

  try {
    const updated = renewLicense({
      licenseId: Number(id),
      additionalDays: additional_days ? Number(additional_days) : null,
      newPlanId: new_plan_id ? Number(new_plan_id) : null,
      actorName: req.user.full_name || req.user.username,
      notes
    });

    res.json({ message: 'License renewed successfully', license: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Suspend License
licensingRouter.post('/licenses/:id/suspend', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    suspendLicense(Number(id), req.user.full_name || req.user.username, reason || 'Administrative suspension');
    res.json({ message: 'License suspended' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Reactivate License
licensingRouter.post('/licenses/:id/reactivate', (req, res) => {
  const { id } = req.params;

  try {
    reactivateLicense(Number(id), req.user.full_name || req.user.username);
    res.json({ message: 'License reactivated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Revoke License
licensingRouter.post('/licenses/:id/revoke', (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    revokeLicense(Number(id), req.user.full_name || req.user.username, reason || 'Revoked by administrator');
    res.json({ message: 'License revoked permanently' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Subscription Invoices & Billing API
// ------------------------------------------
licensingRouter.get('/invoices', (req, res) => {
  try {
    const invoices = db.prepare(`
      SELECT i.*, b.business_name, b.phone AS business_phone, p.name AS plan_name
      FROM sub_invoices i
      JOIN sub_businesses b ON b.id = i.business_id
      JOIN sub_plans p ON p.id = i.plan_id
      ORDER BY i.created_at DESC
    `).all();

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.get('/invoices/:id', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT i.*, b.business_name, b.phone AS business_phone, b.address AS business_address, b.email AS business_email,
             p.name AS plan_name, p.edition, p.billing_interval,
             l.license_key_masked
      FROM sub_invoices i
      JOIN sub_businesses b ON b.id = i.business_id
      JOIN sub_plans p ON p.id = i.plan_id
      LEFT JOIN sub_licenses l ON l.id = i.license_id
      WHERE i.id = ?
    `).get(req.params.id);

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payments = db.prepare(`
      SELECT p.*, u.full_name AS verified_by_name
      FROM sub_payments p
      LEFT JOIN users u ON u.id = p.verified_by
      WHERE p.invoice_id = ?
      ORDER BY p.created_at DESC
    `).all(req.params.id);

    res.json({ invoice, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/invoices', (req, res) => {
  const {
    business_id, license_id, plan_id, billing_period_start, billing_period_end,
    amount_bdt, discount_bdt, tax_bdt, due_date, notes
  } = req.body;

  if (!business_id || !plan_id || amount_bdt === undefined) {
    return res.status(400).json({ error: 'business_id, plan_id, and amount_bdt are required' });
  }

  try {
    const inv = createSubscriptionInvoice({
      businessId: Number(business_id),
      licenseId: license_id ? Number(license_id) : null,
      planId: Number(plan_id),
      periodStart: billing_period_start,
      periodEnd: billing_period_end,
      amount: Math.round(Number(amount_bdt) * 100),
      discount: Math.round(Number(discount_bdt || 0) * 100),
      tax: Math.round(Number(tax_bdt || 0) * 100),
      dueDate: due_date,
      createdBy: req.user.id,
      actorName: req.user.full_name || req.user.username,
      notes
    });

    res.json(inv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Payments API
// ------------------------------------------
licensingRouter.get('/payments', (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, i.invoice_no, b.business_name, u.full_name AS verified_by_name
      FROM sub_payments p
      JOIN sub_invoices i ON i.id = p.invoice_id
      JOIN sub_businesses b ON b.id = i.business_id
      LEFT JOIN users u ON u.id = p.verified_by
      ORDER BY p.created_at DESC
    `).all();

    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/payments', (req, res) => {
  const {
    invoice_id, amount_bdt, payment_method, transaction_ref, notes, payment_date
  } = req.body;

  if (!invoice_id || !amount_bdt || !payment_method) {
    return res.status(400).json({ error: 'invoice_id, amount_bdt, and payment_method are required' });
  }

  try {
    const payment = recordSubscriptionPayment({
      invoiceId: Number(invoice_id),
      amount: Math.round(Number(amount_bdt) * 100),
      paymentMethod: payment_method,
      transactionRef: transaction_ref,
      notes,
      paymentDate: payment_date,
      createdBy: req.user.id,
      actorName: req.user.full_name || req.user.username
    });

    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

licensingRouter.post('/payments/:id/verify', (req, res) => {
  const paymentId = req.params.id;

  try {
    const result = verifySubscriptionPayment({
      paymentId: Number(paymentId),
      verifiedBy: req.user.id,
      actorName: req.user.full_name || req.user.username
    });

    res.json({ message: 'Payment verified successfully', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Devices API
// ------------------------------------------
licensingRouter.get('/devices', (req, res) => {
  try {
    const devices = db.prepare(`
      SELECT d.*, l.license_key_masked, b.business_name
      FROM sub_devices d
      JOIN sub_licenses l ON l.id = d.license_id
      JOIN sub_businesses b ON b.id = l.business_id
      ORDER BY d.registered_at DESC
    `).all();

    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/devices/:id/deactivate', (req, res) => {
  const { id } = req.params;

  try {
    db.prepare(`
      UPDATE sub_devices SET status = 'deactivated' WHERE id = ?
    `).run(id);

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'device.deactivate',
      entityType: 'device',
      entityId: id,
      details: { deactivatedBy: req.user.id },
      ipAddress: req.ip
    });

    res.json({ message: 'Device deactivated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

licensingRouter.post('/devices/:id/approve-replacement', (req, res) => {
  const { id } = req.params;

  try {
    db.prepare(`
      UPDATE sub_devices SET status = 'active' WHERE id = ?
    `).run(id);

    logAudit({
      actorId: req.user.id,
      actorName: req.user.full_name || req.user.username,
      action: 'device.approve_replacement',
      entityType: 'device',
      entityId: id,
      details: { approvedBy: req.user.id },
      ipAddress: req.ip
    });

    res.json({ message: 'Device replacement approved' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ------------------------------------------
// Notifications & Trigger check API
// ------------------------------------------
licensingRouter.get('/notifications', (req, res) => {
  try {
    const list = db.prepare(`
      SELECT n.*, b.business_name, l.license_key_masked
      FROM sub_notifications n
      LEFT JOIN sub_licenses l ON l.id = n.license_id
      LEFT JOIN sub_businesses b ON b.id = l.business_id
      ORDER BY n.sent_at DESC LIMIT 50
    `).all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

licensingRouter.post('/notifications/run-check', (req, res) => {
  try {
    const results = checkExpiryAndNotify();
    res.json({ message: 'Expiry check completed', processed: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------
// Audit History API
// ------------------------------------------
licensingRouter.get('/audit', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.username, u.full_name
      FROM sub_audit_logs a
      LEFT JOIN users u ON u.id = a.actor_id
      ORDER BY a.created_at DESC LIMIT 100
    `).all();

    res.json(logs.map(log => ({
      ...log,
      details: log.details ? JSON.parse(log.details) : null
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
