# Prime POS — Smart Retail POS, Electronics & Installment Management System

> **Developed by [A&M Tech Solutions BD](https://amtechsolutionsbd.com)**  
> 📞 **Phone:** 01736002401 | 🌐 **Website:** [amtechsolutionsbd.com](https://amtechsolutionsbd.com)

**Prime POS** (formerly ElectroPOS) is a modern, high-speed Point of Sale, inventory management, and customer installment/EMI system purpose-built for retail electronics, mobile phone, computer, gadget, and general retail stores.

Engineered with the **AuraGlass Glassmorphic Design System**, Prime POS handles unit-level serialization (**IMEI 1 & 2**, serial numbers), manufacturer warranty tracking, installment billing, customer statement ledgers, shift-based cash drawer reconciliation, sales returns, purchase orders with supplier ledgers, expense tracking, and print-ready vouchers for both **Standard A4** and **80mm POS Thermal Receipt Printers**.

---

## 🚀 Key Features

### 1. ⚡ High-Speed POS Billing
- **Instant Barcode & IMEI Scanning:** USB barcode scanner and keyboard entry friendly. Scanning an IMEI or barcode automatically identifies the product and selects the unit.
- **Flexible Payments:** Supports Cash, bKash, Nagad, Cards, Bank Transfer, and split/mixed payments.
- **Credit & Due Sales:** Full cash, partial payment, or pure credit sales. Calculates change accurately and updates customer balances.
- **Line & Invoice Discounts:** Configurable item-level discounts and overall invoice discounts with role-based discount permissions.
- **Idempotency Protection:** Client sends a unique transaction key per cart to prevent accidental double-billing or duplicate stock decrements.
- **Atomic Transactions:** Guaranteed single-decrement stock transactions inside SQLite transactions to prevent negative stock.

### 2. 📅 Installment / EMI Sales Plans (New!)
- **POS Installment Toggle:** Turn any due sale into a structured installment payment plan with a single toggle.
- **Customizable Schedules:** Set number of installments and payment frequency (**Weekly**, **Monthly**, **Quarterly**).
- **Auto-Calculated Installments:** System calculates expected installment amounts and tracks first/next due dates.
- **Invoice Integration:** Installment plan schedules, frequency, and next payment due dates print directly on both A4 and 80mm thermal invoices.

### 3. 📋 Customer Statement Ledger & Money Receipts (New!)
- **Chronological Statement Ledger:** Unified customer statement displaying all sales invoices (debits), payments/collections (credits), and running balances.
- **Next Installment Tracking:** Customers list displays real-time countdown to the customer's next installment date (e.g. *“12th November, 2026”*).
- **Due Collection Flow:** Collect partial dues or full payoffs directly from the customer ledger modal.
- **Automatic Installment Settlement:** When a customer clears their balance (`৳0.00`), all linked active installment plans are automatically completed.
- **Official Money Receipts (A4 & 80mm Thermal):** Every collection generates an official Money Receipt / Payment Voucher featuring:
  - Unique Receipt Number (`REC-YYYY-XXXXX`)
  - Customer & Cashier details
  - Previous Balance, Amount Paid, and Remaining Balance
  - Next installment schedule or *✓ Fully Settled* badge
  - Dual signature lines (*Customer Signature* & *Authorized Seal/Signature*)
  - Dual print modes: **Standard Voucher Slip (A4)** and **80mm Thermal Slip**

### 4. 📱 Electronics Specialization (IMEI & Serial Tracking)
- **Unit-Level Serial Tracking:** Supports mobile phones with **IMEI 1**, **IMEI 2**, serial number, brand, model, and warranty duration. Laptops, desktops, and monitors track serial numbers and service tags.
- **Double-Sale Prevention:** System strictly validates unit status (`in_stock`) inside database transactions—a serialized unit can never be sold twice.
- **Automatic Warranty Binding:** Selling a serialized item automatically binds the device to the customer invoice and computes the exact warranty expiration date based on the product's warranty term.
- **Restock vs. Defective Returns:** Returned serialized devices can be returned to sellable inventory (`restockable`) or quarantined as `defective` / `repair`.

### 5. 🛡️ Warranty & Device Lookup
- **Instant Search:** Lookup any device by IMEI 1, IMEI 2, Serial Number, or Invoice Number.
- **Live Warranty Status:** Displays a prominent status card:
  - 🟢 **WARRANTY ACTIVE** with real-time days remaining countdown.
  - 🔴 **WARRANTY EXPIRED** with exact date of expiry.
- **Service & Repair Log:** Record customer claims, authorized repairs, device replacements, or diagnostic notes with a complete chronological service timeline.

### 6. 💵 Cash Register & Shift Reconciliation
- **Shift Management:** Cashiers open their register shift with a starting cash float.
- **Real-Time Drawer Formula:**
  $$\text{Expected Cash} = \text{Opening Float} + \text{Cash Sales} + \text{Cash Collections} - \text{Cash Refunds} - \text{Cash Expenses}$$
- **Interactive Denomination Counter:** Closing dialog features a note denomination calculator (৳1000, ৳500, ৳200, ৳100, ৳50, ৳20, ৳10) with visual indicators for exact match, cash excess, or shortage.
- **Audit History:** Full log of past shifts, cashier names, opening floats, closing counts, and discrepancies.

### 7. ↩️ Sales Returns & Refund Management
- **Line-Item Eligibility:** Verifies return quantity cannot exceed original sold quantity minus previously returned units.
- **Condition Grading:** Supports `Restockable (Back to shelf)`, `Damaged (Faulty)`, and `Sent for Repair`.
- **Financial Flexibility:** Issue cash refunds (automatically subtracted from active cash drawer), digital payment reversals, or credit the customer's account to reduce outstanding due.

### 8. 🏷️ Category Management (New!)
- **Category CRUD:** Create, edit, and delete product categories with color tagging and product counts.
- **Quick-Add Category:** Add new categories on the fly directly inside the product creation modal without leaving the page.

### 9. 📦 Inventory & Stock Movements
- **Transaction-Derived Ledger:** Stock is never arbitrarily overwritten—it is derived directly from chronological `stock_movements` (purchases, sales, returns, adjustments, opening).
- **Low-Stock Alerts:** Real-time replenishment warnings for products below minimum alert thresholds.
- **Stock Valuation & Export:** One-click CSV export of stock valuation and inventory counts.

### 10. 🛒 Purchases & Supplier Ledger
- **Purchase Order Lifecycle:** `draft` → `finalized` → `cancelled`. Stock increments exactly once upon finalization.
- **Supplier Statements:** Complete ledger displaying chronological opening balance, purchase bills, payments made, and running payable balances.
- **Direct Supplier Payments:** Record payments toward outstanding supplier dues.

### 11. 📉 Operating Expenses
- Record daily store expenses (Rent, Electricity, Internet, Packaging, Tea/Snacks, Staff lunch).
- Filter by category, payment method, and date.
- Factored into **Estimated Operating Profit** reports.

### 12. 🖨️ Invoices & Printing
- **A4 Layout:** Professional, clean invoice layout suitable for desktop and office printers (e.g. Brother DCP-T230, HP, Canon, Epson).
- **80mm Thermal Receipt Layout:** Compact monospace receipt design optimized for thermal POS receipt printers.
- **Developer Branding:** Invoices feature agency branding 1 inch above the bottom:
  > **For Custom Software & Website — [Amtechsolutionsbd.com](https://amtechsolutionsbd.com) · Phone: 01736002401**
- **Browser Print Engine:** Optimized print media stylesheets with zero clipping, full-page pagination, and no-cache delivery.

### 13. 💾 Database Backup & Restore (New!)
- **Download Database (`.db`):** Download a complete, point-in-time binary copy of the active SQLite database file.
- **JSON Data Backup:** Export all tables, sales, serials, and settings into a structured JSON archive.
- **Upload & Restore:** Restore database from either `.db` or `.json` backup files directly from the browser, with automatic pre-restore safety backups.

### 14. 🔐 Roles & Permissions
- Pre-configured role matrix:
  - **`admin`**: Full access to settings, user management, backups, cancellations, supplier costs, and financial profit reports.
  - **`cashier`**: POS sales, customer management, cash drawer opening/closing, sales returns, and payment collection. Cost prices are hidden.
  - **`stock_manager`**: Product catalog, stock adjustments, purchase orders, and supplier management.
- Secure session tokens stored in `httpOnly` cookies with `scrypt` salted password hashing.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | **Node.js** + **Express 5** | RESTful API, cookie session auth, centralized error handling |
| **Database** | **SQLite** (`better-sqlite3`) | Ultra-fast local database, zero setup, WAL mode (`PRAGMA journal_mode=WAL`), foreign keys enabled |
| **Frontend** | **React 19** + **Vite** | Single Page Application (SPA) with React Router 7 |
| **Design System** | **AuraGlass (Vanilla CSS)** | Glassmorphism, smooth micro-animations, vibrant ambient lighting, dark sidebar, print media rules |
| **Financial Math** | **Integer Minor Units (Poisha)** | All currency stored and calculated as integers ($1 \text{ Taka} = 100 \text{ Poisha}$) to eliminate IEEE 754 floating-point errors |

---

## 📂 Project Structure

```text
POS/
├── server/
│   ├── data/                   # SQLite database (electropos.db)
│   ├── src/
│   │   ├── index.js            # Express application entrypoint & static client serving with cache busting
│   │   ├── db.js               # Database schema, settings defaults, & money helpers
│   │   ├── auth.js             # Password hashing, session middleware, & role permissions
│   │   ├── seed.js             # Demo database seeder (users, products, initial stock)
│   │   └── routes/
│   │       ├── auth.js         # Authentication, user management, & shop settings
│   │       ├── catalog.js      # Products, categories, customers, customer ledger, & collections
│   │       ├── sales.js        # POS billing engine, installments, & invoice data
│   │       ├── purchases.js    # Purchase bills & supplier ledger statements
│   │       ├── expenses.js     # Operating expense records & category breakdowns
│   │       ├── register.js     # Cash register shifts & daily closing reconciliation
│   │       ├── returns.js      # Sales returns & refund adjustments
│   │       ├── serials.js      # IMEI/serial tracking, warranty lookup, & service logs
│   │       ├── reports.js      # Dashboard stats & financial analytics
│   │       └── backup.js       # SQLite database & JSON backup / restore endpoints
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx             # Navigation sidebar, auth state provider, & routing
│   │   ├── api.js              # Fetch client wrapper, currency & ordinal date formatters
│   │   ├── styles.css          # AuraGlass design system, tables, modals, & print stylesheets
│   │   ├── components/
│   │   │   ├── CategoryModal.jsx       # Category CRUD management
│   │   │   ├── CustomerLedgerModal.jsx # Customer chronological statement ledger & collection
│   │   │   └── MoneyReceiptModal.jsx   # A4 & 80mm thermal official payment money receipt
│   │   └── pages/
│   │       ├── Login.jsx           # Glassmorphic login with A&M Tech developer branding
│   │       ├── Dashboard.jsx       # Real-time sales, collections, profit, & dues KPIs
│   │       ├── POS.jsx             # ★ Fast billing terminal with serial/IMEI & installment toggle
│   │       ├── WarrantyLookup.jsx  # ★ Device & IMEI warranty verification + service claims
│   │       ├── SalesHistory.jsx    # Sales invoices list & returns processing modal
│   │       ├── Invoice.jsx         # A4 & 80mm thermal printable receipts with agency footer
│   │       ├── Products.jsx        # Product catalog CRUD with category modal launcher
│   │       ├── Stock.jsx           # Stock overview, serialized units, & movement ledger
│   │       ├── Purchases.jsx       # Purchase bills creation with draft/finalize flow
│   │       ├── Suppliers.jsx       # Supplier profiles & ledger statement viewers
│   │       ├── Customers.jsx       # Customer directory, balance tracking, & next installment info
│   │       ├── Expenses.jsx        # Expense logging & category distribution
│   │       ├── CashRegister.jsx    # Shift floats, note denomination calc, & discrepancies
│   │       └── Settings.jsx        # Store profile, tax rates, website, user management, & backup/restore
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── setup.bat                   # ⚡ One-click Windows setup & launcher script
├── progress.md                 # Complete historical changelog & implementation log
├── PRD.md                      # Product Requirements Document
└── README.md                   # This documentation file
```

---

## 🚦 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)
- **Operating System:** Windows, macOS, or Linux

---

### Quick Setup (Windows)

Simply double-click **`setup.bat`** in the project root to automatically install dependencies, seed sample data, and start the system.

---

### Manual Setup

#### 1. Install Dependencies
```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

#### 2. Seed Database
```bash
cd server
npm run seed
```

#### 3. Running in Development
In two separate terminal windows:

```bash
# Terminal 1: Start Express API server (port 3001)
cd server
npm run dev

# Terminal 2: Start Vite client dev server (port 5173)
cd client
npm run dev
```

Open your browser at **`http://localhost:5173`** (or **`http://localhost:3001`**).

#### 4. Running in Production (Single Server)
```bash
# 1. Build client production bundle
cd client
npm run build

# 2. Start the Express server
cd ../server
npm start
```
Access the application directly at **`http://localhost:3001`**. The server automatically serves the compiled `client/dist` bundle and handles all API routes.

---

## 🔑 Default Login Credentials

| Role | Username | Password | Intended Use |
|---|---|---|---|
| **Shop Owner / Admin** | `admin` | `admin123` | Full access: Settings, users, backup/restore, profit margins, supplier costs |
| **Salesperson / Cashier** | `cashier` | `cashier123` | Billing, customer collections, cash drawer opening/closing, warranty lookup |

*(Passwords can be changed at any time by navigating to **Settings → User Management**).*

---

## 📑 Core API Reference

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/auth/login` | `POST` | Public | Authenticates user and issues httpOnly session cookie |
| `/api/auth/me` | `GET` | Authenticated | Returns current user profile and role |
| `/api/products` | `GET` | `product.view` | Products catalog; supports search by name, SKU, barcode, and IMEI |
| `/api/categories` | `GET/POST` | `stock.manage` | List or create product categories |
| `/api/categories/:id` | `PUT/DELETE` | `stock.manage` | Update or delete product category |
| `/api/sales` | `POST` | `sale.create` | Transactional POS sale; decrements stock, binds serials, creates installment plans |
| `/api/sales/:id` | `GET` | Authenticated | Full invoice data with items, serials, warranty dates, installments, and payments |
| `/api/customers/:id` | `GET` | Authenticated | Unified customer statement ledger, active installment schedule, and dues |
| `/api/customers/:id/collections` | `POST` | `payment.collect` | Records customer due payment, advances installments, and returns Money Receipt |
| `/api/serials/lookup?q=...` | `GET` | Authenticated | Instant device warranty & customer lookup by IMEI or Serial Number |
| `/api/serials/:id/service-logs` | `POST` | `sale.view` | Logs a warranty claim, repair note, or device replacement |
| `/api/register/current` | `GET` | `register.view` | Live cash drawer breakdown and expected balance for active shift |
| `/api/register/open` | `POST` | `register.manage` | Starts shift with opening cash float |
| `/api/register/close` | `POST` | `register.close` | Ends shift, compares counted cash vs expected, logs discrepancies |
| `/api/purchases` | `GET/POST` | `purchase.manage` | Creates purchase bills; finalizing auto-increments stock |
| `/api/suppliers/:id/payments` | `POST` | `supplier.manage` | Records direct supplier payment, reducing outstanding accounts payable |
| `/api/expenses` | `GET/POST` | `expense.create` | Records operating store expense from register or bank |
| `/api/reports/dashboard` | `GET` | Authenticated | Real-time sales, collections, profit, stock, and dues stats |
| `/api/reports/gross-profit` | `GET` | `report.profit` | Net sales, COGS, operating expenses, and estimated operating profit |
| `/api/backup/download-db` | `GET` | `admin` | Direct binary download of active SQLite database file |
| `/api/backup/download-json` | `GET` | `admin` | Full structured JSON database export |
| `/api/backup/restore-db` | `POST` | `admin` | Restores database from uploaded `.db` file |
| `/api/backup/restore-json` | `POST` | `admin` | Restores database from uploaded `.json` backup |
| `/api/settings` | `GET/PUT` | `admin` | Shop profile (name, address, phone, website), tax rates, prefixes, & warranty terms |
| `/api/license/status` | `GET` | Public / Local | Current terminal license status, machine fingerprint, plan, and days remaining |
| `/api/license/activate` | `POST` | Public / Local | Activates terminal using 20-character license key (`PRIME-XXXX-XXXX-XXXX-XXXX`) |
| `/api/licensing/dashboard` | `GET` | Super Admin | Overview metrics: active licenses, revenue, expiring in 7 days, audit logs |
| `/api/licensing/plans` | `GET/POST/PUT` | Super Admin | Manage subscription tiers (Starter, Growth, Enterprise, Lifetime) and features |
| `/api/licensing/businesses` | `GET/POST/PUT` | Super Admin | Register and manage client store business accounts |
| `/api/licensing/licenses` | `GET` | Super Admin | List all issued licenses with active device counts |
| `/api/licensing/licenses/issue` | `POST` | Super Admin | Cryptographically generates random key and issues license |
| `/api/licensing/licenses/:id/renew` | `POST` | Super Admin | Extends license validity by additional days |
| `/api/licensing/licenses/:id/suspend` | `POST` | Super Admin | Suspends license with audit reason |
| `/api/licensing/licenses/:id/reactivate` | `POST` | Super Admin | Reactivates suspended license |
| `/api/licensing/licenses/:id/revoke` | `POST` | Super Admin | Permanently revokes license |
| `/api/licensing/invoices` | `GET/POST` | Super Admin | Manage subscription billing invoices |
| `/api/licensing/invoices/:id` | `GET` | Super Admin | View single invoice with payment records for printing |
| `/api/licensing/payments` | `GET/POST` | Super Admin | Record manual cash, bank transfer, bKash, and Nagad payments |
| `/api/licensing/payments/:id/verify` | `POST` | Super Admin | Verifies payment, updates invoice balance, and activates licenses |
| `/api/licensing/devices` | `GET` | Super Admin | View all registered hardware terminals by machine ID |
| `/api/licensing/devices/:id/deactivate` | `POST` | Super Admin | Deactivates terminal, freeing station slot |
| `/api/licensing/devices/:id/approve-replacement` | `POST` | Super Admin | Approves hardware replacement terminal |
| `/api/licensing/notifications` | `GET` | Super Admin | View log of 7-day, 3-day, and on-expiry alerts |
| `/api/licensing/notifications/run-check` | `POST` | Super Admin | Triggers automated expiry notification scan |
| `/api/licensing/audit` | `GET` | Super Admin | Immutable administrative audit log |

---

## 🔐 Subscription & Licensing Architecture (Hybrid Model)

Prime POS includes an enterprise-grade **Hybrid Cryptographic Licensing Engine** developed by A&M Tech Solutions BD:

1. **Local Machine Fingerprint (Hardware Binding):**
   - Stations generate an immutable Hardware Fingerprint (e.g., `AM-POS-D98D-5879`) using system architecture, platform, and network interface MAC addresses.
   - Prevents unauthorized cloning of application directories or databases across unlicensed counter PCs.
2. **Cryptographic Key Storage:**
   - Raw activation keys (`PRIME-XXXX-XXXX-XXXX-XXXX`) are generated using cryptographically secure random bytes.
   - Only the **SHA-256 hash** of the license key is persisted in the database; raw keys are displayed once upon issuance and cannot be extracted from database dumps.
   - UI displays safe masked identifiers (`PRIME-••••-••••-••••-89NX`).
3. **Grace Period & Non-Interrupting Policy:**
   - Default 7-day grace period upon expiry.
   - Checkout is **never unexpectedly interrupted** in the middle of a business day; during the grace period, an `X-License-Warning` header and top banner are displayed.
   - Read-only operations (sales history, customer ledgers, warranty lookup), database backups, and settings are **always accessible**, even after expiration.
4. **Payment Verification Segregation:**
   - Subscription payments (cash, bank, bKash, Nagad) are segregated from retail sales revenue.
   - Unverified payments remain in `pending` status and **never prematurely extend** or activate a license until explicitly verified by an authorized Super Admin.
5. **Super Admin Management Section:**
   - Accessible via the **Licensing & Plans** link in the authenticated navigation for administrators.
   - Includes real-time dashboards, printable subscription invoices, and official payment receipts.

---

## 🧪 Automated Licensing Test Suite

Run the full end-to-end licensing test suite:
```bash
cd server
node test-licensing-suite.js
```
The suite verifies database migration idempotency, key generation, SHA-256 hashing, terminal hardware binding, device limit enforcement, administrative suspension/reactivation, invoice payments and verification, renewal calculations, and middleware protection.

---

## 🛡️ Business Rules & Safeguards

1. **Integer Minor Units (Poisha):** All monetary values in the database and API payloads are stored in minor units ($1 \text{ Taka} = 100 \text{ Poisha}$). The frontend formats them with `fmtMoney()` (৳).
2. **Derived Inventory:** Sellable stock quantities are calculated directly from `SUM(qty)` in `stock_movements`, ensuring stock can never get out of sync with invoices, purchases, or adjustments.
3. **Double-Sale Guard:** Serialized units have a strictly checked status. Attempting to sell an already sold serial fails with an explicit validation error.
4. **Change is Not Revenue:** Cash overpayments calculate change due to the customer, but change is never recorded as revenue in accounting reports.
5. **Collection vs. Sale Separation:** Due collection payments decrease customer liabilities and generate a Money Receipt without duplicating sales revenue.
6. **Auto-Settlement of Installments:** When a customer's total due balance reaches zero (`৳0.00`), all pending installment plans are automatically settled and marked completed.

---

## 👨‍💻 Developer & Support

Developed by **A&M Tech Solutions BD**  
- **Website:** [https://amtechsolutionsbd.com](https://amtechsolutionsbd.com)  
- **Phone:** `01736002401`  
- **Email:** `support@amtechsolutionsbd.com`

---

## 📄 License
Internal proprietary retail software for **Prime POS** / **A&M Tech Solutions BD**. All rights reserved.
