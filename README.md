# ElectroPOS — Electronics Retail POS & Shop Management System

**ElectroPOS** is a full-featured, high-speed Point of Sale (POS) and inventory management system purpose-built for retail electronics, mobile phone, computer, and gadget stores. 

It handles unit-level serialization (**IMEI 1 & 2**, serial numbers), automated manufacturer warranty tracking, shift-based cash drawer reconciliation, sales returns, purchase orders with supplier ledgers, expense tracking, and print-ready invoices for both **A4** and **80mm thermal receipt printers**.

---

## 🚀 Key Features

### 1. ⚡ High-Speed POS Billing
- **Instant Barcode & IMEI Scanning:** USB barcode scanner and keyboard entry friendly. Scanning an IMEI or barcode automatically identifies the product and selects the unit.
- **Flexible Payments:** Supports Cash, bKash, Nagad, Cards, Bank Transfer, and split/mixed payments.
- **Credit & Partial Due Sales:** Full cash, partial payment, or pure credit sales. Calculates change accurately (never counted as revenue) and tracks customer balances.
- **Line & Invoice Discounts:** Configurable item-level discounts and overall invoice discounts with role-based discount permissions.
- **Idempotency Protection:** Client sends a unique UUID per cart transaction to prevent accidental double-billing or duplicate stock decrements.
- **Negative Stock Protection:** Guaranteed single-decrement stock transactions inside an atomic database transaction.

### 2. 📱 Electronics Specialization (IMEI & Serial Tracking)
- **Unit-Level Serial Tracking (PRD §5):** Supports mobile phones with **IMEI 1**, **IMEI 2**, serial number, brand, model, and warranty duration. Laptops, desktops, and monitors track serial numbers and service tags.
- **Double-Sale Prevention:** System strictly validates unit status (`in_stock`) inside transactions—a serialized unit can never be sold twice.
- **Automatic Warranty Binding:** Selling a serialized item automatically binds the device to the customer invoice and computes the exact warranty expiration date based on the product's warranty term.
- **Restock vs. Defective Returns:** Returned serialized devices can be returned to sellable inventory (`restockable`) or quarantined as `defective` / `repair`.

### 3. 🛡️ Warranty & Device Lookup
- **Instant Search:** Lookup any device by IMEI 1, IMEI 2, Serial Number, or Invoice Number.
- **Live Warranty Status:** Displays a prominent status card:
  - 🟢 **WARRANTY ACTIVE** with real-time days remaining countdown.
  - 🔴 **WARRANTY EXPIRED** with exact date of expiry.
- **Service & Repair Log:** Record customer claims, authorized repairs, device replacements, or diagnostic notes with a complete chronological service timeline.

### 4. 💵 Cash Register & Daily Closing (PRD §14)
- **Shift Management:** Cashiers open their register shift with a starting cash float.
- **Real-Time Drawer Formula:**
  $$\text{Expected Drawer Cash} = \text{Opening Float} + \text{Cash Sales} + \text{Cash Collections} - \text{Cash Refunds} - \text{Cash Expenses}$$
- **Daily Reconciliation:** Closing dialog features an interactive note denomination counter (৳1000, ৳500, ৳200, ৳100, ৳50, ৳20, ৳10) with instant visual indicators for exact match, cash excess, or shortage.
- **Audit History:** Full log of past shifts, cashier names, opening floats, closing counts, and discrepancies.

### 5. ↩️ Sales Returns & Customer Due Collections
- **Line-Item Eligibility:** Verifies return quantity cannot exceed original sold quantity minus previously returned units.
- **Condition Grading:** Supports `Restockable (Back to shelf)`, `Damaged (Faulty)`, and `Sent for Repair`.
- **Financial Flexibility:** Issue cash refunds (automatically subtracted from active cash drawer), digital payment reversals, or credit the customer's account to reduce outstanding due.

### 6. 📦 Inventory & Stock Management
- **Transaction-Derived Ledger:** Stock is never arbitrarily overwritten—it is derived directly from chronological `stock_movements` (purchases, sales, returns, adjustments, opening).
- **Low-Stock Warnings:** Real-time replenishment warnings for products below minimum alert thresholds.
- **Authorized Stock Adjustments:** Require explicit reasons and role permissions.
- **CSV Data Export:** One-click CSV export of stock valuation and inventory counts.

### 7. 🛒 Purchases & Supplier Ledger
- **Purchase Order Lifecycle:** `draft` → `finalized` → `cancelled`. Stock increments exactly once upon finalization.
- **Supplier Statements:** Complete ledger displaying chronological opening balance, purchase bills, payments made, and running payable balances.
- **Direct Supplier Payments:** Record payments toward outstanding supplier dues.

### 8. 📉 Operating Expenses
- Record daily store expenses (Rent, Electricity, Internet, Packaging, Tea/Snacks, Staff lunch).
- Filter by category, payment method, and date.
- Seamlessly factored into **Estimated Operating Profit** reports.

### 9. 🖨️ Invoice Design & Printing
- **A4 Format:** Elegant, professional invoice layout suitable for desktop and office printers.
- **80mm Thermal Receipt Format:** Compact receipt design optimized for thermal POS printers.
- **Device Details Included:** Invoices display IMEIs, serial numbers, customer details, and manufacturer warranty expiry dates.
- Browser print support and instant PDF saving.

### 10. 🔐 Roles & Permissions
- Pre-configured role matrix:
  - **`admin`**: Full access to all settings, user creation, cancellations, supplier costs, and financial profit reports.
  - **`cashier`**: POS sales, customer management, cash drawer opening/closing, sales returns, and payments collection. Cost prices are hidden from cashiers.
  - **`stock_manager`**: Product catalog, stock adjustments, purchase orders, and supplier management.
- Secure session tokens stored in `httpOnly` cookies with `scrypt` salted password hashing.

---

## 🛠️ Technology Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | **Node.js** + **Express 5** | RESTful API, cookie session auth, centralized error handling |
| **Database** | **SQLite** (`better-sqlite3`) | High performance, zero setup, WAL mode (`PRAGMA journal_mode=WAL`), foreign keys enabled |
| **Frontend** | **React 19** + **Vite** | Modern SPA with React Router 7 |
| **Styling** | **Custom Vanilla CSS** | Clean design system tokens, responsive grid layouts, modal overlays, print stylesheets |
| **Financial Math** | **Integer Minor Units (Poisha)** | All currency stored and calculated as integers ($1 \text{ Taka} = 100 \text{ Poisha}$) to eliminate IEEE 754 floating-point rounding errors |

---

## 📂 Project Structure

```text
POS/
├── server/
│   ├── data/                   # SQLite database (electropos.db)
│   ├── src/
│   │   ├── index.js            # Express application entrypoint & static client serving
│   │   ├── db.js               # Database schema, settings defaults, & money helpers
│   │   ├── auth.js             # Password hashing, session middleware, & role permissions
│   │   ├── seed.js             # Demo database seeder (users, products, initial stock)
│   │   └── routes/
│   │       ├── auth.js         # Authentication, user management, & shop settings
│   │       ├── catalog.js      # Products, categories, customers, & IMEI search
│   │       ├── sales.js        # POS billing engine & invoice data
│   │       ├── purchases.js    # Purchase bills & supplier ledger statements
│   │       ├── expenses.js     # Operating expense records & category breakdowns
│   │       ├── register.js     # Cash register shifts & daily closing reconciliation
│   │       ├── returns.js      # Sales returns & refund adjustments
│   │       ├── serials.js      # IMEI/serial tracking, warranty lookup, & service logs
│   │       └── reports.js      # Dashboard stats & financial analytics
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── App.jsx             # Navigation sidebar, auth state provider, & routing
│   │   ├── api.js              # Fetch client wrapper, currency & date formatters
│   │   ├── styles.css          # Design system, table styles, modals, & print media queries
│   │   └── pages/
│   │       ├── Login.jsx           # Clean authentication screen
│   │       ├── Dashboard.jsx       # Real-time sales, collections, profit, & dues KPIs
│   │       ├── POS.jsx             # ★ Fast billing terminal with serial/IMEI picker
│   │       ├── WarrantyLookup.jsx  # ★ Device & IMEI warranty verification + service claims
│   │       ├── SalesHistory.jsx    # Sales invoices list & returns processing modal
│   │       ├── Invoice.jsx         # A4 & 80mm thermal printable receipts
│   │       ├── Products.jsx        # Product catalog CRUD with category filters
│   │       ├── Stock.jsx           # Stock overview, serialized units, & movement ledger
│   │       ├── Purchases.jsx       # Purchase bills creation with draft/finalize flow
│   │       ├── Suppliers.jsx       # Supplier profiles & ledger statement viewers
│   │       ├── Customers.jsx       # Customer directory, balance tracking, & collection modal
│   │       ├── Expenses.jsx        # Expense logging & category distribution
│   │       ├── CashRegister.jsx    # Shift floats, note denomination calc, & discrepancies
│   │       └── Settings.jsx        # Store profile, tax rates, prefixes, & user management
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── progress.md                 # Complete historical changelog & implementation log
├── PRD.md                      # Product Requirements Document
└── README.md                   # This documentation file
```

---

## 🚦 Getting Started

### Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9.0.0 or higher)

### 1. Installation

Clone or extract the repository, then install dependencies for both the backend and frontend:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Database Seeding

Run the seed script to create initial sample users (`admin`, `cashier`), categories, electronics products with serialized units, suppliers, and walk-in customers:

```bash
cd server
npm run seed
```

### 3. Running in Development

In two separate terminal windows:

```bash
# Terminal 1: Start API server (port 3001)
cd server
npm start

# Terminal 2: Start Vite development server (port 5173)
cd client
npm run dev
```

Open your browser at **`http://localhost:5173`** (Vite automatically proxies `/api` calls to `:3001`).

### 4. Running in Production (Single Server)

To deploy or run everything from a single Node process:

```bash
# 1. Build client production bundle
cd client
npm run build

# 2. Start the Express server
cd ../server
npm start
```

Access the application directly at **`http://localhost:3001`**. The server automatically serves the compiled `client/dist` bundle and handles API endpoints.

---

## 🔑 Default Login Credentials

| Role | Username | Password | Intended Use |
|---|---|---|---|
| **Shop Owner / Admin** | `admin` | `admin123` | Full access: Settings, users, reports, profit margins, supplier costs |
| **Salesperson / Cashier** | `cashier` | `cashier123` | Billing, customer collections, cash drawer opening/closing, warranty lookup |

*(Passwords can be changed at any time by navigating to **Settings → User Management**).*

---

## 📑 Core API Reference

| Endpoint | Method | Role Required | Description |
|---|---|---|---|
| `/api/auth/login` | `POST` | Public | Authenticates user and issues httpOnly session cookie |
| `/api/auth/me` | `GET` | Authenticated | Returns current user profile and role |
| `/api/products` | `GET` | `product.view` | Products catalog; supports search by name, SKU, barcode, and IMEI |
| `/api/products/:id/serials` | `GET/POST` | `stock.manage` | List or register serialized units (IMEI 1, IMEI 2, Serial #) |
| `/api/sales` | `POST` | `sale.create` | Transactional POS sale; decrements stock, binds serials, creates payments |
| `/api/sales/:id` | `GET` | Authenticated | Full invoice data with items, serials, warranty dates, and payments |
| `/api/sales/:id/returns` | `POST` | `sale.return` | Processes sales return, adjusts stock, and handles refunds/credits |
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
| `/api/settings` | `GET/PUT` | `admin` | Shop profile, invoice prefix, tax percentage, and warranty terms |

---

## 🛡️ Business Rules & Safeguards

1. **Integer Money Representation:** All monetary values in the database and API payloads are stored in minor units (Poisha). The frontend formats them with `fmtMoney()` (৳).
2. **Derived Inventory:** Sellable stock quantities are calculated directly from `SUM(qty)` in `stock_movements`, ensuring that stock can never get out of sync with invoices, purchases, or adjustments.
3. **Double-Sale Guard:** Serialized units have a strictly checked status. Attempting to sell an already sold serial fails with an explicit validation error.
4. **Change is Not Revenue:** Cash overpayments calculate change due to the customer, but change is never recorded as revenue in accounting reports.
5. **Collection vs. Sale Separation:** Due collection payments decrease customer liabilities without generating artificial sales revenue.

---

## 📄 License
Internal proprietary retail software for ElectroPOS / AMTechSolutions. All rights reserved.
