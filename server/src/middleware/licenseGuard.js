import { db } from '../db.js';
import { getLicenseStatus, getLocalMachineId, logAudit } from '../services/licenseService.js';

/**
 * Gets the active local license for this POS instance.
 * Looks for the active license associated with this machine, or the first active license.
 */
export function getActiveLocalLicense() {
  const machineId = getLocalMachineId();

  // 1. Look for license registered to this hardware machine
  let lic = db.prepare(`
    SELECT l.id FROM sub_licenses l
    JOIN sub_devices d ON d.license_id = l.id
    WHERE d.device_id = ? AND d.status = 'active' AND l.status IN ('active', 'grace_period', 'issued')
    ORDER BY l.id DESC LIMIT 1
  `).get(machineId);

  // 2. If no device bound yet, look for any active or grace license
  if (!lic) {
    lic = db.prepare(`
      SELECT id FROM sub_licenses
      WHERE status IN ('active', 'grace_period', 'issued')
      ORDER BY id DESC LIMIT 1
    `).get();
  }

  // 3. Fallback: most recent license record
  if (!lic) {
    lic = db.prepare(`SELECT id FROM sub_licenses ORDER BY id DESC LIMIT 1`).get();
  }

  if (!lic) return null;
  return getLicenseStatus(lic.id);
}

/**
 * Middleware: Enforces license validity and grace period policies.
 * Never deletes data. Preserves read-only operations, settings, and backups.
 */
export function licenseGuard(req, res, next) {
  // Always permit non-business critical operations even when expired
  const exemptPrefixes = [
    '/api/auth',
    '/api/backup',
    '/api/settings',
    '/api/licensing', // Super Admin licensing operations
    '/api/license',   // Local activation & status
    '/api/health'
  ];

  if (exemptPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  // Always allow GET requests (Read-Only access to past invoices, reports, stock, dues)
  if (req.method === 'GET') {
    return next();
  }

  const lic = getActiveLocalLicense();

  // If no license has ever been issued/activated, allow grace on first run or require activation
  if (!lic) {
    // If no license exists in the database at all, allow operation or return setup notice
    const count = db.prepare('SELECT COUNT(*) AS c FROM sub_licenses').get().c;
    if (count === 0) {
      return next(); // Unlicensed initial demo mode
    }
    return res.status(402).json({
      error: 'License activation required. Please activate your Prime POS license in Settings.',
      code: 'LICENSE_REQUIRED',
      machineId: getLocalMachineId()
    });
  }

  // Check license status
  if (lic.status === 'revoked') {
    return res.status(403).json({
      error: `License has been revoked. Reason: ${lic.revocation_reason || 'Administrative action'}. Contact A&M Tech Solutions BD (01736002401).`,
      code: 'LICENSE_REVOKED'
    });
  }

  if (lic.status === 'suspended') {
    return res.status(403).json({
      error: 'License is currently suspended. Please contact A&M Tech Solutions BD (01736002401).',
      code: 'LICENSE_SUSPENDED'
    });
  }

  if (lic.status === 'expired') {
    return res.status(402).json({
      error: 'Subscription has expired and the grace period has ended. Please renew to continue creating sales.',
      code: 'LICENSE_EXPIRED',
      expiredAt: lic.expires_at,
      graceEndedAt: lic.graceEndsAt,
      machineId: getLocalMachineId()
    });
  }

  // In 'grace_period', we attach warning header but allow transaction to succeed
  if (lic.status === 'grace_period') {
    res.setHeader('X-License-Warning', `Subscription expired. Grace period active (${lic.graceRemainingDays} day(s) remaining).`);
  }

  next();
}

/**
 * Scheduled Daily Expiry Notification Checker
 * Checks active licenses and records alerts for 7 days, 3 days, and expiry day
 */
export function runExpiryNotificationCheck() {
  try {
    const licenses = db.prepare(`
      SELECT l.*, b.business_name, b.phone, b.owner_name, p.name AS plan_name
      FROM sub_licenses l
      JOIN sub_businesses b ON b.id = l.business_id
      JOIN sub_plans p ON p.id = l.plan_id
      WHERE l.status IN ('active', 'grace_period') AND l.expires_at IS NOT NULL
    `).all();

    const now = new Date();

    for (const lic of licenses) {
      const expiry = new Date(lic.expires_at);
      const diffMs = expiry.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(diffMs / (24 * 3600 * 1000));

      let triggerType = null;
      let message = '';

      if (daysUntilExpiry === 7) {
        triggerType = '7_days_before';
        message = `Reminder: Prime POS subscription for ${lic.business_name} expires in 7 days (${expiry.toLocaleDateString()}). Please renew with A&M Tech Solutions BD.`;
      } else if (daysUntilExpiry === 3) {
        triggerType = '3_days_before';
        message = `Urgent: Prime POS subscription for ${lic.business_name} expires in 3 days (${expiry.toLocaleDateString()}). Renew now to prevent interruption.`;
      } else if (daysUntilExpiry <= 0 && daysUntilExpiry >= -lic.grace_period_days) {
        triggerType = daysUntilExpiry === 0 ? 'on_expiry' : 'grace_period_warning';
        message = `Notice: Prime POS subscription for ${lic.business_name} has expired. Grace period active (${lic.grace_period_days + daysUntilExpiry} day(s) left).`;
      }

      if (triggerType) {
        // Prevent duplicate notification today for this trigger
        const existing = db.prepare(`
          SELECT id FROM sub_notifications
          WHERE license_id = ? AND trigger_type = ? AND date(sent_at) = date('now')
        `).get(lic.id, triggerType);

        if (!existing) {
          db.prepare(`
            INSERT INTO sub_notifications (license_id, business_id, trigger_type, channel, recipient, message, status)
            VALUES (?, ?, ?, 'in_app', ?, ?, 'sent')
          `).run(lic.id, lic.business_id, triggerType, lic.phone, message);

          logAudit({
            action: 'notification.dispatch',
            entityType: 'license',
            entityId: lic.id,
            details: { trigger_type: triggerType, recipient: lic.phone, message }
          });
        }
      }
    }
    return [];
  } catch (err) {
    console.error('[Notification Check Error]', err);
    return [];
  }
}

export const checkExpiryAndNotify = runExpiryNotificationCheck;

let schedulerStarted = false;
export function startExpiryScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setInterval(runExpiryNotificationCheck, 12 * 3600 * 1000);
  setTimeout(runExpiryNotificationCheck, 5000);
}

