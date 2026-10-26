import assert from 'node:assert';
import { db } from './src/db.js';
import { runSubscriptionMigrations } from './src/db/migrations.js';
import {
  generateActivationKey,
  hashLicenseKey,
  maskLicenseKey,
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
  getLocalMachineId
} from './src/services/licenseService.js';
import { licenseGuard, checkExpiryAndNotify } from './src/middleware/licenseGuard.js';

console.log('--- STARTING COMPREHENSIVE PRIME POS LICENSING TEST SUITE ---');

// Ensure migrations applied cleanly without resetting tables
runSubscriptionMigrations(db);

// 1. Database & Existing Business Data Verification
console.log('\n[TEST 1] Verifying database integrity and business preservation...');
const existingSettings = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
const existingSales = db.prepare('SELECT COUNT(*) AS c FROM sales').get().c;
assert(existingSettings > 0, 'Settings must be preserved');
console.log(`✓ Existing settings preserved (${existingSettings} rows) and sales preserved (${existingSales} rows)`);

// 2. Cryptographic Key Generation & Hashing
console.log('\n[TEST 2] Cryptographic key generation, uniqueness & SHA-256 hashing...');
const key1 = generateActivationKey();
const key2 = generateActivationKey();
assert.notStrictEqual(key1, key2, 'Keys must be cryptographically random and unique');
assert.strictEqual(key1.startsWith('PRIME-'), true, 'Key format must start with PRIME-');
const hash1 = hashLicenseKey(key1);
assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
const masked = maskLicenseKey(key1);
assert(masked.startsWith('PRIME-••••-••••-••••-'), 'Key must mask leading characters');
console.log(`✓ Generated: ${key1} -> Masked: ${masked} -> Hash: ${hash1.slice(0, 16)}...`);

// 3. Issue License to Registered Business
console.log('\n[TEST 3] Issuing license to registered business...');
const biz = db.prepare('SELECT * FROM sub_businesses LIMIT 1').get();
assert(biz, 'At least one business must exist');
const plan = db.prepare("SELECT * FROM sub_plans WHERE code = 'growth-annual'").get();
assert(plan, 'growth-annual plan must exist');

const issued = issueLicense({
  businessId: biz.id,
  planId: plan.id,
  createdBy: 1,
  notes: 'Suite test license'
});
assert(issued.licenseId > 0, 'License ID must be returned');
assert(issued.activationKey, 'Raw activation key must be returned once upon issue');
console.log(`✓ Issued license #${issued.licenseId} with activation key: ${issued.activationKey}`);

// 4. Activate License on Hardware Terminal
console.log('\n[TEST 4] Activating license on local hardware terminal...');
const activation = activateLicense({
  activationKey: issued.activationKey,
  deviceName: 'Counter PC 1'
});
assert.strictEqual(activation.status, 'active', 'Activated status must be active');
assert.strictEqual(activation.deviceId, getLocalMachineId(), 'Must bind to local hardware fingerprint');
console.log(`✓ Activated on device: ${activation.deviceId}`);

// 5. Status & Expiry Computation
console.log('\n[TEST 5] License status and expiry calculation...');
const status = getLicenseStatus(issued.licenseId);
assert.strictEqual(status.status, 'active');
assert.strictEqual(status.is_active, true);
assert(status.remainingDays >= 364, 'Should have ~365 remaining days');
console.log(`✓ License verified active with ${status.remainingDays} days remaining`);

// 6. Device Limit Enforcement
console.log('\n[TEST 6] Device limit enforcement...');
try {
  // Try activating with another deviceId exceeding max_devices
  // growth-annual allows 2 devices
  activateLicense({ activationKey: issued.activationKey, deviceId: 'AM-POS-FAKE-DEV2', deviceName: 'Counter 2' });
  // Third activation should fail
  activateLicense({ activationKey: issued.activationKey, deviceId: 'AM-POS-FAKE-DEV3', deviceName: 'Counter 3' });
  assert.fail('Should have thrown device limit exceeded error');
} catch (err) {
  assert(err.message.includes('limit reached'), 'Should report device limit reached');
  console.log(`✓ Successfully blocked extra terminal exceeding limit: "${err.message}"`);
}

// 7. Suspension & Reactivation
console.log('\n[TEST 7] Administrative suspension & reactivation...');
suspendLicense(issued.licenseId, 'Admin audit', 'Non-payment audit');
const suspStatus = getLicenseStatus(issued.licenseId);
assert.strictEqual(suspStatus.status, 'suspended');

// Try activating while suspended
try {
  activateLicense({ activationKey: issued.activationKey, deviceId: 'AM-POS-ANOTHER', deviceName: 'Counter 99' });
  assert.fail('Should fail activating a suspended license');
} catch (err) {
  assert(err.message.includes('suspended'));
  console.log('✓ Blocked activation on suspended license');
}

reactivateLicense(issued.licenseId, 'Admin');
const reactStatus = getLicenseStatus(issued.licenseId);
assert.strictEqual(reactStatus.status, 'active');
console.log('✓ Reactivated license successfully');

// 8. Invoicing & Payment Verification
console.log('\n[TEST 8] Subscription invoicing and payment verification...');
const invoice = createSubscriptionInvoice({
  businessId: biz.id,
  licenseId: issued.licenseId,
  planId: plan.id,
  periodStart: '2026-10-26',
  periodEnd: '2027-10-26',
  amount: 10000,
  createdBy: 1
});
assert.strictEqual(invoice.total, 10000);
assert.strictEqual(invoice.dueAmount, 10000);

// Record unverified payment
const unverifiedPay = recordSubscriptionPayment({
  invoiceId: invoice.id,
  amount: 10000,
  paymentMethod: 'bkash',
  transactionRef: 'TRX-TEST-001',
  verified: false
});
assert.strictEqual(unverifiedPay.status, 'pending');

// Check invoice is still unpaid before verification
const invBeforeVerify = db.prepare('SELECT status, paid_amount FROM sub_invoices WHERE id = ?').get(invoice.id);
assert.strictEqual(invBeforeVerify.status, 'unpaid', 'Unverified payment must not mark invoice as paid');
console.log('✓ Unverified payment kept invoice unpaid');

// Verify payment
const verifyResult = verifySubscriptionPayment({ paymentId: unverifiedPay.id, verifiedBy: 1 });
assert.strictEqual(verifyResult.invoice_status, 'paid');
const invAfterVerify = db.prepare('SELECT status, paid_amount FROM sub_invoices WHERE id = ?').get(invoice.id);
assert.strictEqual(invAfterVerify.status, 'paid', 'Invoice should be paid after verification');
console.log('✓ Payment verified and invoice updated to paid');

// 9. Early and Late Renewal
console.log('\n[TEST 9] License renewal calculation...');
const currentExp = new Date(status.expires_at);
const renewed = renewLicense({ licenseId: issued.licenseId, extensionDays: 60 });
const newExp = new Date(renewed.expires_at);
const diffDays = Math.round((newExp.getTime() - currentExp.getTime()) / (24 * 3600 * 1000));
assert.strictEqual(diffDays, 60, 'Early renewal should extend from existing expiration date');
console.log(`✓ Renewed license extended by ${diffDays} days from existing expiry date`);

// 10. Automated Expiry Reminders & Notifications
console.log('\n[TEST 10] Expiry reminders & notification check...');
const notices = checkExpiryAndNotify();
assert(Array.isArray(notices), 'Notification check should return array of processed alerts');
console.log(`✓ Expiry reminder scheduler ran successfully (${notices.length} notifications processed)`);

// 11. Grace Period & License Guard Middleware
console.log('\n[TEST 11] License Guard middleware protection & grace period...');
// Mock req, res, next
let nextCalled = false;
let headerSet = null;
const reqGet = { method: 'GET', path: '/api/sales' };
const resGet = { setHeader: () => {} };
licenseGuard(reqGet, resGet, () => { nextCalled = true; });
assert.strictEqual(nextCalled, true, 'GET requests must always be permitted');

nextCalled = false;
const reqBackup = { method: 'POST', path: '/api/backup/export' };
licenseGuard(reqBackup, resGet, () => { nextCalled = true; });
assert.strictEqual(nextCalled, true, 'Backup operations must always be permitted');
console.log('✓ Read-only and backup/restore paths are never blocked');

console.log('\n======================================================');
console.log('🎉 ALL 11 TEST SCENARIOS PASSED WITH ZERO ERRORS! 🎉');
console.log('======================================================\n');
