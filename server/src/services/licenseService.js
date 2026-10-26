import crypto from 'node:crypto';
import os from 'node:os';
import { db, toMinor, fromMinor } from '../db.js';

// ============================================================
// Cryptographic Keys & Hashing Helpers
// ============================================================

/**
 * Computes standard SHA-256 hash of a string
 */
export function hashLicenseKey(rawKey) {
  const normalized = String(rawKey || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Masks a license key for safe display (e.g. PRIME-XXXX-XXXX-XXXX-8F42)
 */
export function maskLicenseKey(rawKey) {
  const clean = String(rawKey || '').trim().toUpperCase();
  if (clean.length < 10) return 'PRIME-••••-••••';
  const lastGroup = clean.slice(-4);
  return `PRIME-••••-••••-••••-${lastGroup}`;
}

/**
 * Generates a formatted activation key: PRIME-XXXX-XXXX-XXXX-XXXX
 * Uses cryptographically secure random bytes
 */
export function generateActivationKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Base32 without confusing 0/O, 1/I
  const groups = [];
  for (let g = 0; g < 4; g++) {
    let part = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      part += chars[bytes[i] % chars.length];
    }
    groups.push(part);
  }
  return `PRIME-${groups.join('-')}`;
}

/**
 * Extracts a stable hardware machine fingerprint for the current station
 */
export function getLocalMachineId() {
  const network = os.networkInterfaces();
  const macs = [];
  for (const name of Object.keys(network)) {
    for (const net of network[name] || []) {
      if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
        macs.push(net.mac);
      }
    }
  }
  const rawFingerprint = [
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || 'GenericCPU',
    os.hostname(),
    macs.sort().join(';')
  ].join('|');

  const digest = crypto.createHash('sha256').update(rawFingerprint).digest('hex');
  return `AM-POS-${digest.slice(0, 4).toUpperCase()}-${digest.slice(4, 8).toUpperCase()}`;
}

// ============================================================
// Audit Logging Helper
// ============================================================

export function logAudit({ actorId = null, actorName = 'System', action, entityType, entityId, details = {}, ip = '' }) {
  try {
    let validUserId = null;
    if (typeof actorId === 'number' && Number.isInteger(actorId) && actorId > 0) {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(actorId);
      if (u) validUserId = u.id;
    }

    db.prepare(`
      INSERT INTO sub_audit_logs (actor_id, actor_name, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      validUserId,
      actorName || 'System',
      action,
      entityType,
      String(entityId),
      typeof details === 'string' ? details : JSON.stringify(details),
      ip || ''
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}

// ============================================================
// Sequence Number Generators
// ============================================================

export function getNextSubNumber(counterName, prefix) {
  const year = new Date().getFullYear();
  const row = db.transaction(() => {
    db.prepare(`
      INSERT INTO sub_counters (name, year, seq) VALUES (?, ?, 1)
      ON CONFLICT(name) DO UPDATE SET
        seq = CASE WHEN sub_counters.year = excluded.year THEN sub_counters.seq + 1 ELSE 1 END,
        year = excluded.year
    `).run(counterName, year);
    return db.prepare('SELECT seq, year FROM sub_counters WHERE name = ?').get(counterName);
  })();
  return `${prefix}-${row.year}-${String(row.seq).padStart(5, '0')}`;
}

// ============================================================
// License Lifecycle Operations
// ============================================================

/**
 * Issues a new license to a registered business
 */
export function issueLicense({ businessId, planId, startsAt = null, customDurationDays = null, gracePeriodDays = 7, createdBy = null, actorName = 'Super Admin', notes = '' }) {
  const biz = db.prepare('SELECT * FROM sub_businesses WHERE id = ?').get(businessId);
  if (!biz) throw Object.assign(new Error('Business account not found'), { status: 404 });

  const plan = db.prepare('SELECT * FROM sub_plans WHERE id = ?').get(planId);
  if (!plan) throw Object.assign(new Error('Subscription plan not found'), { status: 404 });
  if (!plan.active) throw Object.assign(new Error('Selected plan is inactive'), { status: 400 });

  const durationDays = customDurationDays || plan.duration_days;
  const now = new Date();
  const startDate = startsAt ? new Date(startsAt) : now;
  const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 3600 * 1000);

  const rawKey = generateActivationKey();
  const keyHash = hashLicenseKey(rawKey);
  const keyMasked = maskLicenseKey(rawKey);

  const result = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO sub_licenses (
        license_key_hash, license_key_masked, business_id, plan_id,
        status, issued_at, starts_at, expires_at, grace_period_days,
        max_devices, active_devices, created_by
      ) VALUES (?, ?, ?, ?, 'issued', datetime('now'), ?, ?, ?, ?, 0, ?)
    `).run(
      keyHash,
      keyMasked,
      biz.id,
      plan.id,
      startDate.toISOString(),
      expiryDate.toISOString(),
      gracePeriodDays || 7,
      plan.max_devices,
      createdBy
    );

    const licenseId = info.lastInsertRowid;

    // Create initial subscription term record
    db.prepare(`
      INSERT INTO sub_subscriptions (license_id, business_id, plan_id, period_start, period_end, status, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(licenseId, biz.id, plan.id, startDate.toISOString(), expiryDate.toISOString(), notes || 'Initial license issue');

    logAudit({
      actorId: createdBy,
      actorName,
      action: 'license.issue',
      entityType: 'license',
      entityId: licenseId,
      details: {
        business_name: biz.business_name,
        plan_name: plan.name,
        duration_days: durationDays,
        expires_at: expiryDate.toISOString(),
        masked_key: keyMasked
      }
    });

    return {
      licenseId,
      activationKey: rawKey, // Returned once for copy/send
      maskedKey: keyMasked,
      businessName: biz.business_name,
      planName: plan.name,
      expiresAt: expiryDate.toISOString(),
      gracePeriodDays: gracePeriodDays || 7
    };
  })();

  return result;
}

/**
 * Activates a license from an activation key and registers device
 */
export function activateLicense({ activationKey, deviceId = null, deviceName = 'Primary Counter', osInfo = '', ipAddress = '' }) {
  if (!activationKey) throw Object.assign(new Error('Activation key is required'), { status: 400 });

  const keyHash = hashLicenseKey(activationKey);
  const license = db.prepare(`
    SELECT l.*, p.name AS plan_name, p.enabled_features, p.duration_days, b.business_name, b.status AS business_status
    FROM sub_licenses l
    JOIN sub_plans p ON p.id = l.plan_id
    JOIN sub_businesses b ON b.id = l.business_id
    WHERE l.license_key_hash = ?
  `).get(keyHash);

  if (!license) {
    throw Object.assign(new Error('Invalid activation key. Please check and try again.'), { status: 404 });
  }

  if (license.business_status === 'suspended') {
    throw Object.assign(new Error('This business account is suspended. Please contact A&M Tech Solutions BD.'), { status: 403 });
  }

  if (license.status === 'revoked') {
    throw Object.assign(new Error(`This license has been revoked. Reason: ${license.revocation_reason || 'N/A'}`), { status: 403 });
  }

  if (license.status === 'suspended') {
    throw Object.assign(new Error('This license is currently suspended. Please contact support.'), { status: 403 });
  }

  const machineId = deviceId || getLocalMachineId();

  const activatedLicense = db.transaction(() => {
    // Check if device already registered
    const existingDevice = db.prepare('SELECT * FROM sub_devices WHERE license_id = ? AND device_id = ?').get(license.id, machineId);

    if (existingDevice) {
      if (existingDevice.status === 'deactivated') {
        throw Object.assign(new Error('This station has been deactivated. Contact your administrator for approval.'), { status: 403 });
      }
      db.prepare(`UPDATE sub_devices SET last_active_at = datetime('now'), ip_address = ? WHERE id = ?`).run(ipAddress, existingDevice.id);
    } else {
      // Check device limits
      const activeCount = db.prepare("SELECT COUNT(*) AS c FROM sub_devices WHERE license_id = ? AND status = 'active'").get(license.id).c;
      if (activeCount >= license.max_devices) {
        throw Object.assign(new Error(`Device activation limit reached. This plan allows max ${license.max_devices} active station(s).`), { status: 403 });
      }

      db.prepare(`
        INSERT INTO sub_devices (license_id, device_id, device_name, os_info, ip_address, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(license.id, machineId, deviceName, osInfo || os.platform(), ipAddress);

      db.prepare('UPDATE sub_licenses SET active_devices = active_devices + 1 WHERE id = ?').run(license.id);
    }

    // If first activation, set activated_at and ensure starts_at / expires_at are active
    const now = new Date();
    let newExpiresAt = license.expires_at;

    if (license.status === 'issued') {
      const expiry = new Date(now.getTime() + license.duration_days * 24 * 3600 * 1000);
      newExpiresAt = expiry.toISOString();
      db.prepare(`
        UPDATE sub_licenses SET
          status = 'active',
          activated_at = datetime('now'),
          starts_at = datetime('now'),
          expires_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(newExpiresAt, license.id);
    }

    logAudit({
      actorName: license.business_name,
      action: 'license.activate',
      entityType: 'license',
      entityId: license.id,
      details: { device_id: machineId, device_name: deviceName, ip: ipAddress }
    });

    return {
      licenseId: license.id,
      businessName: license.business_name,
      planName: license.plan_name,
      status: 'active',
      expiresAt: newExpiresAt,
      deviceId: machineId,
      features: JSON.parse(license.enabled_features || '[]')
    };
  })();

  return activatedLicense;
}

/**
 * Computes current validity and status of a license
 */
export function getLicenseStatus(licenseId) {
  let targetId = licenseId;
  const localMachineId = getLocalMachineId();

  if (!targetId) {
    const dev = db.prepare('SELECT license_id FROM sub_devices WHERE device_id = ? AND status = ? ORDER BY last_active_at DESC LIMIT 1').get(localMachineId, 'active');
    if (dev) {
      targetId = dev.license_id;
    } else {
      const anyActive = db.prepare("SELECT id FROM sub_licenses WHERE status IN ('active', 'grace_period') ORDER BY issued_at DESC LIMIT 1").get();
      if (anyActive) targetId = anyActive.id;
    }
  }

  if (!targetId) {
    return {
      is_active: false,
      status: 'unlicensed',
      machine_id: localMachineId,
      message: 'No active license found for this installation'
    };
  }

  const l = db.prepare(`
    SELECT l.*, p.name AS plan_name, p.code AS plan_code, p.edition, p.billing_interval,
           p.max_users, p.max_branches, p.enabled_features, p.support_tier,
           b.business_name, b.phone AS business_phone, b.status AS business_status
    FROM sub_licenses l
    JOIN sub_plans p ON p.id = l.plan_id
    JOIN sub_businesses b ON b.id = l.business_id
    WHERE l.id = ?
  `).get(targetId);

  if (!l) {
    return {
      is_active: false,
      status: 'unlicensed',
      machine_id: localMachineId,
      message: 'License record not found'
    };
  }

  const now = new Date();
  const expiresAt = l.expires_at ? new Date(l.expires_at) : null;
  const graceDays = l.grace_period_days || 7;
  const graceEndsAt = expiresAt ? new Date(expiresAt.getTime() + graceDays * 24 * 3600 * 1000) : null;

  let computedStatus = l.status;
  let remainingDays = 0;
  let graceRemainingDays = 0;

  if (l.status === 'active' || l.status === 'grace_period' || l.status === 'expired') {
    if (expiresAt) {
      const diffMs = expiresAt.getTime() - now.getTime();
      remainingDays = Math.ceil(diffMs / (24 * 3600 * 1000));

      if (now <= expiresAt) {
        computedStatus = 'active';
      } else if (graceEndsAt && now <= graceEndsAt) {
        computedStatus = 'grace_period';
        const graceDiff = graceEndsAt.getTime() - now.getTime();
        graceRemainingDays = Math.ceil(graceDiff / (24 * 3600 * 1000));
      } else {
        computedStatus = 'expired';
      }
    }
  }

  // Sync computed status if changed
  if (computedStatus !== l.status && ['active', 'grace_period', 'expired'].includes(l.status)) {
    db.prepare("UPDATE sub_licenses SET status = ?, updated_at = datetime('now') WHERE id = ?").run(computedStatus, l.id);
  }

  return {
    ...l,
    is_active: computedStatus === 'active' || computedStatus === 'grace_period',
    status: computedStatus,
    machine_id: localMachineId,
    remainingDays: Math.max(0, remainingDays),
    graceRemainingDays: Math.max(0, graceRemainingDays),
    graceEndsAt: graceEndsAt ? graceEndsAt.toISOString() : null,
    features: JSON.parse(l.enabled_features || '[]')
  };
}

/**
 * Renews an existing license
 */
export function renewLicense({ licenseId, extensionDays = null, newPlanId = null, actorId = null, actorName = 'Super Admin', notes = '' }) {
  const l = db.prepare('SELECT * FROM sub_licenses WHERE id = ?').get(licenseId);
  if (!l) throw Object.assign(new Error('License not found'), { status: 404 });
  if (l.status === 'revoked') throw Object.assign(new Error('Cannot renew a revoked license'), { status: 400 });

  const targetPlanId = newPlanId || l.plan_id;
  const plan = db.prepare('SELECT * FROM sub_plans WHERE id = ?').get(targetPlanId);
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });

  const daysToAdd = extensionDays || plan.duration_days;
  const now = new Date();
  const currentExpiry = l.expires_at ? new Date(l.expires_at) : now;

  // Rule: If renewed before expiry, extend from existing expiry date. If renewed after expiry, start from today.
  const baseDate = (currentExpiry > now && l.status === 'active') ? currentExpiry : now;
  const newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 3600 * 1000);

  const renewed = db.transaction(() => {
    db.prepare(`
      UPDATE sub_licenses SET
        plan_id = ?,
        status = 'active',
        expires_at = ?,
        max_devices = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(plan.id, newExpiry.toISOString(), plan.max_devices, l.id);

    // Record subscription history
    db.prepare(`
      INSERT INTO sub_subscriptions (license_id, business_id, plan_id, period_start, period_end, status, notes)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(l.id, l.business_id, plan.id, baseDate.toISOString(), newExpiry.toISOString(), notes || `Renewed for ${daysToAdd} days`);

    logAudit({
      actorId,
      actorName,
      action: 'license.renew',
      entityType: 'license',
      entityId: l.id,
      details: {
        previous_expiry: l.expires_at,
        new_expiry: newExpiry.toISOString(),
        days_added: daysToAdd,
        plan_name: plan.name
      }
    });

    return {
      licenseId: l.id,
      status: 'active',
      newExpiresAt: newExpiry.toISOString(),
      expires_at: newExpiry.toISOString(),
      daysAdded: daysToAdd
    };
  })();

  return renewed;
}

/**
 * Suspends a license
 */
export function suspendLicense(licenseId, reason = '', actorId = null, actorName = 'Super Admin') {
  const l = db.prepare('SELECT * FROM sub_licenses WHERE id = ?').get(licenseId);
  if (!l) throw Object.assign(new Error('License not found'), { status: 404 });

  db.prepare(`UPDATE sub_licenses SET status = 'suspended', updated_at = datetime('now') WHERE id = ?`).run(licenseId);
  logAudit({
    actorId,
    actorName,
    action: 'license.suspend',
    entityType: 'license',
    entityId: licenseId,
    details: { reason }
  });
  return { ok: true };
}

/**
 * Reactivates a suspended license
 */
export function reactivateLicense(licenseId, actorId = null, actorName = 'Super Admin') {
  const l = db.prepare('SELECT * FROM sub_licenses WHERE id = ?').get(licenseId);
  if (!l) throw Object.assign(new Error('License not found'), { status: 404 });
  if (l.status === 'revoked') throw Object.assign(new Error('Revoked license cannot be reactivated'), { status: 400 });

  const now = new Date();
  const expiresAt = l.expires_at ? new Date(l.expires_at) : null;
  const graceDays = l.grace_period_days || 7;
  const graceEndsAt = expiresAt ? new Date(expiresAt.getTime() + graceDays * 24 * 3600 * 1000) : null;

  let restoredStatus = 'active';
  if (expiresAt) {
    if (now <= expiresAt) restoredStatus = 'active';
    else if (graceEndsAt && now <= graceEndsAt) restoredStatus = 'grace_period';
    else restoredStatus = 'expired';
  }

  db.prepare(`UPDATE sub_licenses SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(restoredStatus, licenseId);
  logAudit({
    actorId,
    actorName,
    action: 'license.reactivate',
    entityType: 'license',
    entityId: licenseId,
    details: { restored_status: restoredStatus }
  });
  return { ok: true, status: restoredStatus };
}

/**
 * Revokes a license permanently
 */
export function revokeLicense(licenseId, reason = '', actorId = null, actorName = 'Super Admin') {
  const l = db.prepare('SELECT * FROM sub_licenses WHERE id = ?').get(licenseId);
  if (!l) throw Object.assign(new Error('License not found'), { status: 404 });

  db.prepare(`
    UPDATE sub_licenses SET
      status = 'revoked',
      revocation_reason = ?,
      revoked_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(reason || 'Administrative revocation', licenseId);

  // Deactivate all linked devices
  db.prepare(`UPDATE sub_devices SET status = 'deactivated' WHERE license_id = ?`).run(licenseId);

  logAudit({
    actorId,
    actorName,
    action: 'license.revoke',
    entityType: 'license',
    entityId: licenseId,
    details: { reason }
  });
  return { ok: true };
}

// ============================================================
// Billing & Invoicing Engine
// ============================================================

export function createSubscriptionInvoice({ businessId, licenseId = null, planId, discount = 0, taxAmount = 0, notes = '', createdBy = null, actorName = 'Super Admin' }) {
  const biz = db.prepare('SELECT * FROM sub_businesses WHERE id = ?').get(businessId);
  if (!biz) throw Object.assign(new Error('Business account not found'), { status: 404 });

  const plan = db.prepare('SELECT * FROM sub_plans WHERE id = ?').get(planId);
  if (!plan) throw Object.assign(new Error('Plan not found'), { status: 404 });

  const invNo = getNextSubNumber('invoice', 'SUB-INV');
  const subtotal = plan.price;
  const discMinor = toMinor(discount);
  const taxMinor = toMinor(taxAmount);
  const total = Math.max(0, subtotal - discMinor + taxMinor);

  const now = new Date();
  const periodEnd = new Date(now.getTime() + plan.duration_days * 24 * 3600 * 1000);

  const info = db.prepare(`
    INSERT INTO sub_invoices (
      invoice_no, business_id, license_id, plan_id,
      billing_period_start, billing_period_end, subtotal, discount,
      tax_amount, total, paid_amount, due_amount, status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?, ?)
  `).run(
    invNo,
    biz.id,
    licenseId || null,
    plan.id,
    now.toISOString(),
    periodEnd.toISOString(),
    subtotal,
    discMinor,
    taxMinor,
    total,
    total,
    notes,
    createdBy
  );

  logAudit({
    actorId: createdBy,
    actorName,
    action: 'sub_invoice.create',
    entityType: 'sub_invoice',
    entityId: info.lastInsertRowid,
    details: { invoice_no: invNo, total: fromMinor(total), business_name: biz.business_name }
  });

  return {
    id: info.lastInsertRowid,
    invoiceNo: invNo,
    total: fromMinor(total),
    dueAmount: fromMinor(total)
  };
}

export function recordSubscriptionPayment(options = {}) {
  let { invoiceId = null, businessId = null, licenseId = null, amount, method, paymentMethod, transactionRef = '', notes = '', verified = false, actorId = null, actorName = 'Super Admin' } = options;

  const rawMethod = (paymentMethod || method || '').toLowerCase();
  const normalizedMethod = rawMethod === 'bank_transfer' ? 'bank' : rawMethod;
  if (!['cash', 'bank', 'bkash', 'nagad'].includes(normalizedMethod)) {
    throw Object.assign(new Error('Invalid payment method. Must be cash, bank, bkash, or nagad'), { status: 400 });
  }

  if (!businessId && invoiceId) {
    const inv = db.prepare('SELECT business_id, license_id FROM sub_invoices WHERE id = ?').get(invoiceId);
    if (inv) {
      businessId = inv.business_id;
      if (!licenseId) licenseId = inv.license_id;
    }
  }

  let amtMinor;
  if (options.amountPoisha !== undefined) {
    amtMinor = Math.round(Number(options.amountPoisha));
  } else if (invoiceId) {
    const inv = db.prepare('SELECT due_amount, total FROM sub_invoices WHERE id = ?').get(invoiceId);
    if (inv && (amount === inv.due_amount || amount === inv.total)) {
      amtMinor = amount;
    } else {
      amtMinor = toMinor(amount);
    }
  } else {
    amtMinor = toMinor(amount);
  }
  if (!amtMinor || amtMinor <= 0) throw Object.assign(new Error('Valid payment amount required'), { status: 400 });

  const biz = db.prepare('SELECT * FROM sub_businesses WHERE id = ?').get(businessId);
  if (!biz) throw Object.assign(new Error('Business account not found'), { status: 404 });

  const recNo = getNextSubNumber('receipt', 'SUB-REC');

  const paymentRecord = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO sub_payments (
        receipt_no, invoice_id, business_id, license_id,
        amount, method, transaction_ref, status, verified_by, verified_at, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recNo,
      invoiceId || null,
      biz.id,
      licenseId || null,
      amtMinor,
      normalizedMethod,
      transactionRef.trim(),
      verified ? 'verified' : 'pending',
      verified ? actorId : null,
      verified ? new Date().toISOString() : null,
      notes,
      actorId
    );

    const paymentId = info.lastInsertRowid;

    // If linked to an invoice and verified, reduce invoice due amount
    if (invoiceId && verified) {
      const inv = db.prepare('SELECT * FROM sub_invoices WHERE id = ?').get(invoiceId);
      if (inv) {
        const newPaid = (inv.paid_amount || 0) + amtMinor;
        const newDue = Math.max(0, inv.total - newPaid);
        const newStatus = newDue === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

        db.prepare(`
          UPDATE sub_invoices SET
            paid_amount = ?,
            due_amount = ?,
            status = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(newPaid, newDue, newStatus, inv.id);

        if (newStatus === 'paid' && inv.license_id) {
          const lic = db.prepare('SELECT status FROM sub_licenses WHERE id = ?').get(inv.license_id);
          if (lic && lic.status === 'issued') {
            db.prepare(`UPDATE sub_licenses SET status = 'active', activated_at = datetime('now') WHERE id = ?`).run(inv.license_id);
          }
        }
      }
    }

    logAudit({
      actorId,
      actorName,
      action: verified ? 'sub_payment.record_verified' : 'sub_payment.record_pending',
      entityType: 'sub_payment',
      entityId: paymentId,
      details: {
        receipt_no: recNo,
        amount: fromMinor(amtMinor),
        method: normalizedMethod,
        transaction_ref: transactionRef,
        verified
      }
    });

    return {
      id: paymentId,
      paymentId,
      receipt_no: recNo,
      receiptNo: recNo,
      amount: fromMinor(amtMinor),
      method: normalizedMethod,
      status: verified ? 'verified' : 'pending'
    };
  })();

  return paymentRecord;
}

export function verifySubscriptionPayment(arg1, arg2, arg3) {
  let paymentId;
  let actorId;
  let actorName = 'Super Admin';

  if (typeof arg1 === 'object' && arg1 !== null) {
    paymentId = arg1.paymentId || arg1.id;
    actorId = arg1.verifiedBy || arg1.actorId;
    actorName = arg1.actorName || 'Super Admin';
  } else {
    paymentId = arg1;
    actorId = arg2;
    actorName = arg3 || 'Super Admin';
  }

  const p = db.prepare('SELECT * FROM sub_payments WHERE id = ?').get(paymentId);
  if (!p) throw Object.assign(new Error('Payment record not found'), { status: 404 });
  if (p.status === 'verified') return { ok: true, alreadyVerified: true, invoice_status: 'paid' };

  let invoiceStatus = 'pending';
  db.transaction(() => {
    db.prepare(`
      UPDATE sub_payments SET
        status = 'verified',
        verified_by = ?,
        verified_at = datetime('now')
      WHERE id = ?
    `).run(actorId, paymentId);

    if (p.invoice_id) {
      const inv = db.prepare('SELECT * FROM sub_invoices WHERE id = ?').get(p.invoice_id);
      if (inv) {
        const newPaid = (inv.paid_amount || 0) + p.amount;
        const newDue = Math.max(0, inv.total - newPaid);
        invoiceStatus = newDue === 0 ? 'paid' : (newPaid > 0 ? 'partially_paid' : 'unpaid');

        db.prepare(`
          UPDATE sub_invoices SET
            paid_amount = ?,
            due_amount = ?,
            status = ?,
            updated_at = datetime('now')
          WHERE id = ?
        `).run(newPaid, newDue, invoiceStatus, inv.id);

        if (invoiceStatus === 'paid' && inv.license_id) {
          const lic = db.prepare('SELECT status FROM sub_licenses WHERE id = ?').get(inv.license_id);
          if (lic && lic.status === 'issued') {
            db.prepare(`UPDATE sub_licenses SET status = 'active', activated_at = datetime('now') WHERE id = ?`).run(inv.license_id);
          }
        }
      }
    }

    logAudit({
      actorId,
      actorName,
      action: 'sub_payment.verify',
      entityType: 'sub_payment',
      entityId: paymentId,
      details: {
        receipt_no: p.receipt_no,
        amount: fromMinor(p.amount)
      }
    });
  })();

  return { ok: true, invoice_status: invoiceStatus };
}

