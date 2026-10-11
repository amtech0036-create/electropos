# ElectroPOS — Development Progress

**Last updated:** 2026-10-11
**Status:** Phase 1 (Essential POS), Phase 2 (Shop Management), and Phase 3 (Electronics Specialization) complete and verified end-to-end.

---

## Stack (decided)

| Part | Choice |
|---|---|
| Backend | Node.js + Express 5, `server/` |
| Database | SQLite via `better-sqlite3` (file: `server/data/electropos.db`) — zero-setup; integer minor units schema |
| Frontend | React 19 + Vite + react-router, `client/` |
| Money | Integer poisha (minor units) everywhere in DB/API; decimals only at UI edge |
| Auth | DB-backed sessions in httpOnly cookie, scrypt password hashes |

## How to run

```bash
cd server && npm install && npm run seed && npm start      # API on :3001
cd client && npm install && npm run dev                     # UI on :5173 (proxies /api)
# production: cd client && npm run build  →  server serves client/dist on :3001
```

Login: `admin / admin123` (owner), `cashier / cashier123` (salesperson). Default Walk-in Customer exists (id 1).

---

## ✅ Done (Phase 1 — Essential POS)

| Module | Details |
|---|---|
| Auth & roles | Login/logout, admin+cashier roles, server-enforced permissions (PRD §2, §19) |
| Products & categories | CRUD, auto-SKU, barcode search, 16 default categories, deactivate-not-delete, stock derived from movements only (PRD §4) |
| Customers | Quick add from POS, search by name/phone, ledger, due collections that reduce due without creating sales (PRD §8, §19.4) |
| POS billing | Search/scan (barcode Enter = instant add), cart with qty/price/item+invoice discount, tax hook, cash/bKash/Nagad/card payments, partial & pure-credit (due) sales, change calculated and never counted as revenue (PRD §6) |
| Idempotency | Client sends UUID per cart; repeated submits return the same invoice — no double stock/payment (PRD §19.14) |
| Stock safety | Negative stock blocked, decrement exactly once inside a DB transaction (PRD §19.1) |
| Invoices | Auto invoice numbers (`INV-YYYY-00001`), A4 + 80mm thermal views, browser print + Save PDF, reprint doesn't alter the sale (PRD §15) |
| Sales history | Search, view, reprint; cancellation (admin) restocks + reverses payments with audit (PRD §6.2) |
| Dashboard | Sales revenue, cash collected, est. gross profit, customer due, low stock, recent sales, best sellers — all shown separately (PRD §3) |
| Reports | Daily sales, gross profit/COGS, payment summary, customer due, stock valuation (PRD §13 subset) |
| Purchases & Suppliers | Full purchases lifecycle (`draft` → `finalized` → `cancelled`), auto-numbering (`PUR-YYYY-00001`), stock increment on finalize, supplier ledger with opening balance, purchase bills, payments made, and running payable balances; direct supplier payments (PRD §7, §9) |
| Verification done | Sale decrements stock exactly once; duplicate submit blocked; oversell rejected; change excluded from revenue; mixed payment reconciles; collection reduces due; profit = price − cost; cashier blocked from stock adjust and from seeing purchase cost; purchases increment stock and update supplier ledger; cancellations reverse stock safely; client production build passes |

---

## ✅ Done (Phase 2 — Shop Management)

1. **Purchases & Suppliers (PRD §7, §9)**:
   - `purchases`, `purchase_items`, `supplier_payments`, `purchase_counters` tables in `db.js`.
   - Transactional purchases endpoints in `purchases.js`.
   - Supplier ledger statement calculating running liability balance.
   - `Purchases.jsx` and `Suppliers.jsx` pages in UI.

2. **Expenses API + UI (PRD §10)**:
   - Routes in `expenses.js`: `GET/POST /expenses`, `GET /expenses/categories`, `GET /expenses/summary`, `DELETE /expenses/:id`.
   - Integration with gross profit reporting (`/reports/gross-profit`).
   - `Expenses.jsx` page with period filters, categories, and payment methods.

3. **Stock Module (PRD §12)**:
   - Authorized manual adjustments (`POST /api/products/:id/adjust`) with mandatory reason.
   - Global movement history audit log (`GET /api/stock/movements`).
   - Low-stock alerts (`GET /api/stock/low-stock`) and CSV export.
   - `Stock.jsx` page in UI.

4. **Cash Register & Daily Closing (PRD §14)**:
   - `register_sessions` table in `db.js`.
   - Routes in `register.js`: open session, live drawer formula calculation (`Opening Float + Sales + Collections - Refunds - Expenses = Expected`), closing reconciliation with cash excess/shortage difference.
   - `CashRegister.jsx` page with shift KPI cards, interactive note denomination calculator (৳1000, ৳500, etc.), and discrepancy log.

5. **Sales Returns (PRD §11.1)**:
   - `sale_returns`, `sale_return_items`, `return_counters` tables in `db.js`.
   - Routes in `returns.js`: return eligibility check, oversell protection, condition handling (`restockable` restores inventory; `damaged`/`repair` logs defective stock), refund methods (Cash, digital, Customer Credit).
   - Integrated into `SalesHistory.jsx` with return modal and full returns audit log.

6. **Settings & Users Management UI (PRD §16)**:
   - Shop profile configuration (name, address, tax rate, invoice prefixes, warranty terms).
   - User account management (passwords, roles, activation) in `Settings.jsx`.

---

## ✅ Done (Phase 3 — Electronics Specialization)

7. **IMEI / Serial Unit Tracking (PRD §5.1, §5.2)**:
   - **Backend**:
     - `product_serials` table in `db.js`: `id`, `product_id`, `imei_1`, `imei_2`, `serial_no`, `status` (`in_stock`, `sold`, `returned`, `defective`), `purchase_id`, `sale_id`, `sale_item_id`, `warranty_start_date`, `warranty_end_date`, `notes`.
     - Endpoints in `routes/serials.js`: `GET /api/products/:id/serials`, `POST /api/products/:id/serials` (serial stock-in with automatic stock movement creation), `GET /api/serials`, `PUT /api/serials/:id/status`.
     - Direct IMEI/Serial search in `catalog.js`: scanning an IMEI or serial into product search instantly identifies the serialized product.
     - POS Billing in `sales.js`: enforces unit selection for serialized products (`serial_ids`), binds unit to invoice, transitions status to `'sold'`, and assigns warranty dates.
     - **Double-sale prevention strictly enforced**: rejects sale if unit status is not `'in_stock'`.
   - **Frontend**:
     - POS Cart (`POS.jsx`): Shows "IMEI Tracked" badges, inline IMEI/Serial selector for each unit, and auto-populates cart when an IMEI barcode is scanned in search.
     - Serialized inventory tab in `Stock.jsx`: View all units filtered by status (`in_stock`, `sold`, `defective`), and "Register Serial Units" modal.

8. **Warranty Management & Customer Lookup (PRD §5, §11.2, §15)**:
   - **Backend**:
     - `serial_service_logs` table in `db.js`: `id`, `serial_id`, `user_id`, `service_type` (`claim`, `repair`, `note`, `replacement`), `note`, `created_at`.
     - Endpoint `GET /api/serials/lookup?q=...`: instant lookup by IMEI 1, IMEI 2, Serial #, or Invoice #, calculating active warranty status and days remaining.
     - Endpoint `POST /api/serials/:id/service-logs`: record service claims and repair notes.
   - **Frontend**:
     - `client/src/pages/WarrantyLookup.jsx`: Dedicated search page with instant device identifiers, sale details, prominent Warranty Status banner (🟢 Active with countdown vs 🔴 Expired), and service claim logging with timeline history.
     - Invoice display (`Invoice.jsx`): Displays IMEI 1, IMEI 2, Serial Number, and warranty expiration date on both A4 printable invoices and 80mm thermal receipts.
     - Linked in sidebar navigation (`/warranty`).

---

## Key file map

```
server/src/db.js            schema + settings + money helpers (toMinor/fromMinor)
server/src/auth.js          hashing, sessions, requirePermission + role matrix
server/src/routes/auth.js   login/logout/users/settings
server/src/routes/catalog.js products/categories/customers/stock movements + IMEI search
server/src/routes/sales.js  ★ POS core: transactional sale creation + serial/warranty binding
server/src/routes/purchases.js Purchases lifecycle + Supplier ledger
server/src/routes/expenses.js Expenses categorization and reporting
server/src/routes/register.js Cash register & daily closing reconciliation
server/src/routes/returns.js Sales returns & refund adjustments
server/src/routes/serials.js IMEI/serial tracking, warranty lookup, service logs
server/src/routes/reports.js dashboard + financial reports
client/src/pages/POS.jsx    ★ POS billing screen with serial/IMEI picker
client/src/pages/WarrantyLookup.jsx ★ Warranty & device lookup with service logs
client/src/pages/CashRegister.jsx Cash drawer & shift closing
client/src/pages/SalesHistory.jsx Sales invoices & sales returns
client/src/pages/Stock.jsx  Stock adjustments, ledger, low-stock, and serialized inventory
client/src/pages/Invoice.jsx A4 + 80mm print with serials and warranty dates
client/src/pages/Settings.jsx Shop settings and user accounts
client/src/pages/*          Dashboard, Products, Customers, Purchases, Suppliers, Expenses
```
