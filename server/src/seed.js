import { db, toMinor } from './db.js';
import { hashPassword } from './auth.js';

const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
if (hasUsers) {
  console.log('Already seeded, skipping. Delete server/data/electropos.db to reseed.');
  process.exit(0);
}

const insertUser = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
insertUser.run('admin', hashPassword('admin123'), 'Shop Owner', 'admin');
insertUser.run('cashier', hashPassword('cashier123'), 'Salesperson', 'cashier');

db.prepare('INSERT INTO customers (name, phone, is_walkin) VALUES (?, ?, 1)').run('Walk-in Customer', '');

const insertSupplier = db.prepare('INSERT INTO suppliers (name, company_name, phone, address, notes) VALUES (?, ?, ?, ?, ?)');
insertSupplier.run('Smart Electronics Importers', 'Smart Distribution Ltd.', '+8801711000111', 'IDB Bhaban, Agargaon, Dhaka', 'Primary mobile and monitor distributor');
insertSupplier.run('Star Tech Wholesale', 'Star Tech & Engineering Ltd.', '+8801712000222', 'Multiplan Center, New Elephant Road, Dhaka', 'Official computer parts supplier');

const admin = db.prepare("SELECT id FROM users WHERE username='admin'").get();

const cat = (name) => db.prepare('SELECT id FROM categories WHERE name = ?').get(name).id;
const insertProduct = db.prepare(`INSERT INTO products
  (name, category_id, brand, model, sku, purchase_cost, selling_price, min_stock_alert, tracking_type, warranty_months)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let skuCounter = 0;
const nextSku = () => `PRD-${String(++skuCounter).padStart(4, '0')}`;
const insertOpening = db.prepare(`INSERT INTO stock_movements (product_id, qty, type, source_type, user_id, reason)
  VALUES (?, ?, 'opening', 'opening', ?, 'Opening stock')`);

const products = [
  ['Samsung Galaxy A15', 'Mobile Phones', 'Samsung', 'SM-A155', 14500, 16999, 2, 'serial', 12],
  ['iPhone 13 128GB', 'Mobile Phones', 'Apple', 'MKLD3', 48000, 56500, 1, 'serial', 12],
  ['Xiaomi Redmi Note 13', 'Mobile Phones', 'Xiaomi', '23124RA98I', 17800, 20500, 3, 'serial', 12],
  ['Lenovo IdeaPad Slim 3', 'Laptops', 'Lenovo', '15IAH8', 52000, 61000, 1, 'serial', 12],
  ['Dell Inspiron 15', 'Laptops', 'Dell', '3520', 58000, 67500, 1, 'serial', 12],
  ['HP 245 G8 Notebook', 'Laptops', 'HP', '47U01PA', 44000, 51000, 0, 'serial', 12],
  ['A4TECH Keyboard KBS-8', 'Keyboards and Mice', 'A4TECH', 'KBS-8', 650, 899, 10, 'quantity', 6],
  ['Logitech Mouse B100', 'Keyboards and Mice', 'Logitech', 'B100', 720, 999, 8, 'quantity', 12],
  ['TP-Link Router Archer C6', 'Routers and Networking', 'TP-Link', 'Archer C6', 2100, 2799, 3, 'quantity', 12],
  ['Samsung 24\" Monitor', 'Monitors', 'Samsung', 'S24R350', 12500, 14999, 2, 'serial', 12],
  ['SanDisk 128GB Pen Drive', 'Storage Devices (SSD, HDD, Pen Drive)', 'SanDisk', 'CZ43', 780, 1150, 15, 'quantity', 0],
  ['JBL Tune 520BT', 'Headphones and Earphones', 'JBL', 'Tune 520BT', 4200, 5499, 4, 'quantity', 12]
];

for (const [name, catName, brand, model, cost, price, stock, tracking, warranty] of products) {
  const info = insertProduct.run(name, cat(catName), brand, model, nextSku(), toMinor(cost), toMinor(price), stock > 0 ? 2 : 0, tracking, warranty);
  if (stock > 0) insertOpening.run(info.lastInsertRowid, stock, admin.id);
}

// Give every product a unique barcode for scanner testing (simulating EAN stickers)
const all = db.prepare('SELECT id FROM products').all();
for (const p of all) {
  db.prepare('UPDATE products SET barcode = ? WHERE id = ?').run(`890${String(p.id).padStart(9, '0')}`, p.id);
}

console.log('Seeded: admin/admin123, cashier/cashier123, walk-in customer, 12 products.');
