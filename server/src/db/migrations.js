import crypto from 'node:crypto';
import { db, toMinor } from '../db.js';

export function runSubscriptionMigrations() {
  db.exec(`
    -- 1. Upgrade users table to support Super Admin privilege
    PRAGMA foreign_keys = OFF;
  `);

  // Safe ALTER TABLE for users
  try {
    db.exec(`ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0;`);
  } catch (e) {
    // Column already exists
  }

  // Ensure default admin user is marked as Super Admin
  try {
    db.prepare(`UPDATE users SET is_super_admin = 1 WHERE username = 'admin' AND is_super_admin = 0`).run();
  } catch (e) {
    // Ignore update error if table/user not ready
  }

  db.exec(`
    PRAGMA foreign_keys = ON;

    -- 2. Subscription Plans
    CREATE TABLE IF NOT EXISTS sub_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,                -- e.g. 'basic-monthly', 'enterprise-annual'
      name TEXT NOT NULL,                       -- e.g. 'Basic Starter', 'Enterprise Pro'
      edition TEXT NOT NULL DEFAULT 'Standard', -- 'Standard', 'Professional', 'Enterprise'
      billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'quarterly', 'annual', 'lifetime')),
      duration_days INTEGER NOT NULL DEFAULT 30,
      price INTEGER NOT NULL DEFAULT 0,         -- In minor poisha (e.g. 100000 = 1,000.00 BDT)
      max_users INTEGER NOT NULL DEFAULT 2,
      max_devices INTEGER NOT NULL DEFAULT 1,
      max_branches INTEGER NOT NULL DEFAULT 1,
      enabled_features TEXT NOT NULL DEFAULT '["pos","sales","inventory"]', -- JSON array of feature keys
      support_tier TEXT NOT NULL DEFAULT 'Standard',                         -- 'Standard', 'Priority', 'Dedicated 24/7'
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 3. Customer / Business Accounts (The client businesses purchasing the software)
    CREATE TABLE IF NOT EXISTS sub_businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      trade_license_no TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 4. Licenses (Generated activation keys and cryptographic records)
    CREATE TABLE IF NOT EXISTS sub_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 hash of activation key
      license_key_masked TEXT NOT NULL,          -- e.g. 'PRIME-XXXX-XXXX-XXXX-8F42'
      business_id INTEGER NOT NULL REFERENCES sub_businesses(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES sub_plans(id),
      status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'active', 'grace_period', 'expired', 'suspended', 'revoked')),
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      activated_at TEXT,
      starts_at TEXT,
      expires_at TEXT,
      grace_period_days INTEGER NOT NULL DEFAULT 7,
      max_devices INTEGER NOT NULL DEFAULT 1,
      active_devices INTEGER NOT NULL DEFAULT 0,
      revocation_reason TEXT DEFAULT '',
      revoked_at TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Index for fast lookup by hashed key
    CREATE INDEX IF NOT EXISTS idx_sub_licenses_hash ON sub_licenses(license_key_hash);
    CREATE INDEX IF NOT EXISTS idx_sub_licenses_status ON sub_licenses(status, expires_at);

    -- 5. Subscriptions (Historical & current subscription billing terms)
    CREATE TABLE IF NOT EXISTS sub_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL REFERENCES sub_licenses(id) ON DELETE CASCADE,
      business_id INTEGER NOT NULL REFERENCES sub_businesses(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES sub_plans(id),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'renewed', 'expired', 'cancelled')),
      auto_renew INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. Subscription Invoices (Independent from retail customer sales)
    CREATE TABLE IF NOT EXISTS sub_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,           -- e.g. 'SUB-INV-2026-00001'
      business_id INTEGER NOT NULL REFERENCES sub_businesses(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES sub_licenses(id),
      plan_id INTEGER NOT NULL REFERENCES sub_plans(id),
      billing_period_start TEXT NOT NULL,
      billing_period_end TEXT NOT NULL,
      subtotal INTEGER NOT NULL,                 -- minor poisha
      discount INTEGER NOT NULL DEFAULT 0,       -- minor poisha
      tax_amount INTEGER NOT NULL DEFAULT 0,     -- minor poisha
      total INTEGER NOT NULL,                    -- minor poisha
      paid_amount INTEGER NOT NULL DEFAULT 0,    -- minor poisha
      due_amount INTEGER NOT NULL DEFAULT 0,     -- minor poisha
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'void')),
      notes TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_invoices_no ON sub_invoices(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_sub_invoices_biz ON sub_invoices(business_id);

    -- 7. Subscription Payments (Verification workflow)
    CREATE TABLE IF NOT EXISTS sub_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT NOT NULL UNIQUE,           -- e.g. 'SUB-REC-2026-00001'
      invoice_id INTEGER REFERENCES sub_invoices(id),
      business_id INTEGER NOT NULL REFERENCES sub_businesses(id) ON DELETE CASCADE,
      license_id INTEGER REFERENCES sub_licenses(id),
      amount INTEGER NOT NULL,                   -- minor poisha
      method TEXT NOT NULL CHECK (method IN ('cash', 'bank', 'bkash', 'nagad')),
      transaction_ref TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'rejected')),
      verified_by INTEGER REFERENCES users(id),
      verified_at TEXT,
      notes TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_payments_biz ON sub_payments(business_id);
    CREATE INDEX IF NOT EXISTS idx_sub_payments_rec ON sub_payments(receipt_no);

    -- 8. Registered Devices / Station Activations (Hardware Binding)
    CREATE TABLE IF NOT EXISTS sub_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL REFERENCES sub_licenses(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,                   -- Machine / Hardware Fingerprint
      device_name TEXT NOT NULL DEFAULT 'Counter PC',
      os_info TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'pending_approval')),
      last_active_at TEXT NOT NULL DEFAULT (datetime('now')),
      registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(license_id, device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_sub_devices_lic ON sub_devices(license_id, device_id);

    -- 9. Expiry Notifications & Delivery Logs
    CREATE TABLE IF NOT EXISTS sub_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL REFERENCES sub_licenses(id) ON DELETE CASCADE,
      business_id INTEGER NOT NULL REFERENCES sub_businesses(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('7_days_before', '3_days_before', 'on_expiry', 'grace_period_warning')),
      channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'whatsapp', 'email')),
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed')),
      error_message TEXT DEFAULT '',
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_notifications_dedup ON sub_notifications(license_id, trigger_type, channel);

    -- 10. Audit History (Immutable log of all licensing and billing administrative operations)
    CREATE TABLE IF NOT EXISTS sub_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id INTEGER REFERENCES users(id),
      actor_name TEXT NOT NULL DEFAULT 'System',
      action TEXT NOT NULL,                      -- e.g. 'plan.create', 'license.issue', 'license.activate', 'payment.verify'
      entity_type TEXT NOT NULL,                 -- e.g. 'license', 'payment', 'device', 'plan'
      entity_id TEXT NOT NULL,
      details TEXT DEFAULT '{}',                 -- JSON payload of changes
      ip_address TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sub_audit_entity ON sub_audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sub_audit_created ON sub_audit_logs(created_at);

    -- 11. Subscription Counters (for Invoice and Receipt sequence numbers)
    CREATE TABLE IF NOT EXISTS sub_counters (
      name TEXT PRIMARY KEY,
      year INTEGER NOT NULL,
      seq INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed default plans if not already present
  seedDefaultPlans();
}

function seedDefaultPlans() {
  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO sub_plans
      (code, name, edition, billing_interval, duration_days, price, max_users, max_devices, max_branches, enabled_features, support_tier, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  // 1. Basic Starter (Monthly) - ৳1,000 / month
  insertPlan.run(
    'starter-monthly',
    'Starter Retail',
    'Standard',
    'monthly',
    30,
    toMinor(1000), // ৳1,000
    2,  // 2 users
    1,  // 1 device
    1,  // 1 branch
    JSON.stringify(['pos', 'sales', 'inventory', 'customers', 'receipts']),
    'Standard',
  );

  // 2. Growth / Professional (Annual) - ৳10,000 / year (save ৳2,000)
  insertPlan.run(
    'growth-annual',
    'Professional Store',
    'Professional',
    'annual',
    365,
    toMinor(10000), // ৳10,000
    5,  // 5 users
    2,  // 2 devices
    1,  // 1 branch
    JSON.stringify(['pos', 'sales', 'inventory', 'customers', 'receipts', 'installments', 'warranty_imei', 'expenses', 'register']),
    'Priority',
  );

  // 3. Enterprise Multi-Branch (Annual) - ৳22,000 / year
  insertPlan.run(
    'enterprise-annual',
    'Enterprise Chain',
    'Enterprise',
    'annual',
    365,
    toMinor(22000), // ৳22,000
    15, // 15 users
    5,  // 5 devices
    3,  // 3 branches
    JSON.stringify(['pos', 'sales', 'inventory', 'customers', 'receipts', 'installments', 'warranty_imei', 'expenses', 'register', 'backup_restore', 'advanced_reports']),
    'Dedicated 24/7',
  );

  // 4. Lifetime Retail License - ৳45,000 one-time
  insertPlan.run(
    'lifetime-retail',
    'Lifetime Retail License',
    'Enterprise',
    'lifetime',
    36500, // 100 years
    toMinor(45000), // ৳45,000
    10,
    3,
    1,
    JSON.stringify(['pos', 'sales', 'inventory', 'customers', 'receipts', 'installments', 'warranty_imei', 'expenses', 'register', 'backup_restore', 'advanced_reports']),
    'Dedicated 24/7',
  );

  seedDefaultBusiness(db);
}

function seedDefaultBusiness(db) {
  const existingCount = db.prepare('SELECT COUNT(*) AS count FROM sub_businesses').get();
  if (existingCount.count > 0) return;

  const getSetting = (k, def = '') => {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
      return row ? row.value : def;
    } catch {
      return def;
    }
  };

  const shopName = getSetting('shop_name', 'Uttara Computers');
  const shopPhone = getSetting('shop_phone', '01743383764');
  const shopAddress = getSetting('shop_address', 'Shop 64, 3rd Floor BNS Center Uttara Dhaka 1230');
  const shopWebsite = getSetting('shop_website', 'https://uttaracomputer.com');

  db.prepare(`
    INSERT INTO sub_businesses (
      business_name, owner_name, phone, address, status
    ) VALUES (?, ?, ?, ?, 'active')
  `).run(
    shopName,
    'Store Owner',
    shopPhone,
    shopAddress
  );
}


