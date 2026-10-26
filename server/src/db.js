import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.ELECTROPOS_DB_PATH || path.join(dataDir, 'electropos.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','cashier','stock_manager')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  brand TEXT DEFAULT '',
  model TEXT DEFAULT '',
  sku TEXT NOT NULL UNIQUE,
  barcode TEXT UNIQUE,
  purchase_cost INTEGER NOT NULL DEFAULT 0,
  selling_price INTEGER NOT NULL DEFAULT 0,
  wholesale_price INTEGER,
  min_stock_alert INTEGER NOT NULL DEFAULT 0,
  tracking_type TEXT NOT NULL DEFAULT 'quantity' CHECK (tracking_type IN ('quantity','serial')),
  warranty_months INTEGER,
  image_url TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  is_walkin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','sale','return','adjustment','opening')),
  source_type TEXT NOT NULL,
  source_id INTEGER,
  reason TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  subtotal INTEGER NOT NULL,
  item_discount_total INTEGER NOT NULL DEFAULT 0,
  invoice_discount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  due INTEGER NOT NULL DEFAULT 0,
  change_given INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','cancelled')),
  idempotency_key TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_idem ON sales(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id),
  method TEXT NOT NULL CHECK (method IN ('cash','bkash','nagad','card','bank')),
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale','collection')),
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT (date('now')),
  category TEXT NOT NULL,
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  description TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invoice_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_no TEXT NOT NULL UNIQUE,
  supplier_invoice_no TEXT DEFAULT '',
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  purchase_date TEXT NOT NULL DEFAULT (date('now')),
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  due INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','cancelled')),
  payment_method TEXT DEFAULT 'cash',
  idempotency_key TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_idem ON purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_cost INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  line_total INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER REFERENCES purchases(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  method TEXT NOT NULL CHECK (method IN ('cash','bkash','nagad','card','bank')),
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'purchase' CHECK (kind IN ('purchase','payment')),
  notes TEXT DEFAULT '',
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS register_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  opening_cash INTEGER NOT NULL DEFAULT 0,
  closing_cash INTEGER,
  expected_cash INTEGER,
  difference INTEGER,
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE TABLE IF NOT EXISTS sale_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_no TEXT NOT NULL UNIQUE,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  total_refund INTEGER NOT NULL,
  refund_method TEXT NOT NULL CHECK (refund_method IN ('cash','bkash','nagad','card','credit')),
  reason TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES sale_returns(id),
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  refund_amount INTEGER NOT NULL,
  condition TEXT NOT NULL DEFAULT 'restockable' CHECK (condition IN ('restockable','damaged','repair'))
);

CREATE TABLE IF NOT EXISTS return_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  imei_1 TEXT,
  imei_2 TEXT,
  serial_no TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','returned','defective')),
  purchase_id INTEGER REFERENCES purchases(id),
  sale_id INTEGER REFERENCES sales(id),
  sale_item_id INTEGER REFERENCES sale_items(id),
  warranty_start_date TEXT,
  warranty_end_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_serials_imei1 ON product_serials(imei_1) WHERE imei_1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_serials_serial ON product_serials(serial_no) WHERE serial_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS serial_service_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_id INTEGER NOT NULL REFERENCES product_serials(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  service_type TEXT NOT NULL DEFAULT 'note' CHECK (service_type IN ('note','claim','repair','replacement')),
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

try {
  db.exec(`ALTER TABLE sale_items ADD COLUMN serial_info TEXT DEFAULT ''`);
} catch (e) {
  // column already exists
}

// Installment tracking for due sales
db.exec(`
CREATE TABLE IF NOT EXISTS sale_installments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  total_installments INTEGER NOT NULL DEFAULT 1,
  installment_amount INTEGER NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

try {
  db.exec("ALTER TABLE sale_installments ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
} catch (e) {}

try {
  db.exec("ALTER TABLE sale_installments ADD COLUMN paid_installments INTEGER NOT NULL DEFAULT 0");
} catch (e) {}

try {
  db.exec("ALTER TABLE payments ADD COLUMN notes TEXT DEFAULT ''");
} catch (e) {}

try {
  db.exec("ALTER TABLE payments ADD COLUMN transaction_ref TEXT DEFAULT ''");
} catch (e) {}

try {
  db.exec("ALTER TABLE payments ADD COLUMN receipt_no TEXT DEFAULT ''");
} catch (e) {}

db.exec(`
CREATE TABLE IF NOT EXISTS receipt_counters (
  year INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);
`);


const seedCategories = db.prepare(`INSERT OR IGNORE INTO categories (name) VALUES (?)`);
const defaults = [
  'Mobile Phones','Laptops','Desktop Computers','Monitors','Printers and Scanners',
  'Keyboards and Mice','Headphones and Earphones','Chargers and Cables','Power Banks',
  'Routers and Networking','Storage Devices (SSD, HDD, Pen Drive)','RAM and Computer Components',
  'Speakers','Gaming Accessories','Smartwatches','Other Electronics'
];
for (const c of defaults) seedCategories.run(c);

const upsertSetting = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`);
upsertSetting.run('shop_name', 'ElectroPOS Shop');
upsertSetting.run('shop_address', '');
upsertSetting.run('shop_phone', '');
upsertSetting.run('currency', 'BDT');
upsertSetting.run('tax_rate_percent', '0');
upsertSetting.run('invoice_prefix', 'INV-');
upsertSetting.run('purchase_prefix', 'PUR-');
upsertSetting.run('show_serial_on_invoice', '0');
upsertSetting.run('warranty_terms', '7 days replacement, brand warranty as per manufacturer.');
upsertSetting.run('return_prefix', 'RET-');

// Populate initial demo serial numbers for serialized products if empty
try {
  const serialCount = db.prepare('SELECT COUNT(*) AS c FROM product_serials').get().c;
  if (serialCount === 0) {
    const insertSerial = db.prepare(`INSERT INTO product_serials
      (product_id, imei_1, imei_2, serial_no, status, notes)
      VALUES (?, ?, ?, ?, 'in_stock', ?)`);

    const serProds = db.prepare(`SELECT id, name, sku FROM products WHERE tracking_type = 'serial'`).all();
    for (const p of serProds) {
      if (p.name.includes('Galaxy')) {
        insertSerial.run(p.id, '352849102938471', '352849102938472', 'R58N102ABC1', 'Factory Sealed Box');
        insertSerial.run(p.id, '352849102938473', '352849102938474', 'R58N102ABC2', 'Factory Sealed Box');
      } else if (p.name.includes('iPhone')) {
        insertSerial.run(p.id, '359284109283741', '', 'F2LJ89K0MD01', 'Official BTRC Approved');
      } else if (p.name.includes('Redmi')) {
        insertSerial.run(p.id, '864920194820191', '864920194820192', 'XM231248901', 'Official Global Version');
        insertSerial.run(p.id, '864920194820193', '864920194820194', 'XM231248902', 'Official Global Version');
        insertSerial.run(p.id, '864920194820195', '864920194820196', 'XM231248903', 'Official Global Version');
      } else if (p.name.includes('IdeaPad')) {
        insertSerial.run(p.id, '', '', 'PF39XK21001', 'Includes 65W original charger');
      } else if (p.name.includes('Dell')) {
        insertSerial.run(p.id, '', '', 'CN08X291001', 'Service Tag: 8X29101');
      } else if (p.name.includes('Monitor')) {
        insertSerial.run(p.id, '', '', 'MN24R35001', 'VGA & HDMI tested');
        insertSerial.run(p.id, '', '', 'MN24R35002', 'New in box');
      }
    }
  }
} catch (e) {
  // ignore seed errors
}

// Money helper: convert taka decimal string to integer poisha (avoid float money math)
export function toMinor(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
export function fromMinor(minor) {
  return (minor ?? 0) / 100;
}
