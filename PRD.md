# ElectroPOS — Electronics Shop POS Software
## Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** October 2026  
**Target market:** Bangladesh  
**Currency:** Bangladeshi Taka (BDT, ৳)

---

## 1. Product Overview

ElectroPOS is a simple, easy-to-use point-of-sale and shop-management application for electronics retailers. It is designed for mobile phone shops, computer shops, laptop sellers, and electronics/accessories stores.

The software must be approachable for users with basic computer skills. Common tasks should require as few clicks as possible. Avoid unnecessary configuration, complex accounting terminology, and features that do not support daily shop operations.

### Product vision

Help a shop owner or employee quickly sell products, print invoices, manage stock, track customer and supplier balances, record expenses, and understand shop performance from one straightforward application.

### Target businesses

- Mobile phone shops
- Laptop and desktop computer shops
- Computer accessories shops
- Electronics and gadget retailers
- Mixed electronics stores

### Primary goals

- Fast, simple checkout
- Reliable inventory tracking
- IMEI and serial-number tracking for eligible products
- Professional invoices
- Customer and supplier due tracking
- Daily sales, expense, stock, and profit reports
- Secure access for owners and employees

---

## 2. User Roles and Permissions

### 2.1 Shop Owner / Admin

Can manage products, categories, purchases, sales, customers, suppliers, expenses, users, settings, reports, stock adjustments, and financial summaries.

### 2.2 Cashier / Salesperson

Can create sales, search products, register customers, collect payments, and print invoices. Cannot change sensitive settings, purchase costs, stock adjustments, or delete/cancel completed sales without permission.

### 2.3 Stock Manager (Optional)

Can manage products, stock, purchases, suppliers, and stock adjustments. Access to sensitive financial reports can be restricted.

### General permission rules

- Enforce permissions on the backend as well as the user interface.
- Record the user responsible for important transactions.
- Require authorized approval for sensitive changes.
- The first version supports one shop with multiple user accounts. Multi-branch management is a future enhancement.

---

## 3. Dashboard

After login, show a clean dashboard with:

- Today's sales total
- Number of completed sales today
- Today's estimated gross profit
- Payment totals by method
- Total active products
- Low-stock alerts
- Customer outstanding due
- Supplier outstanding due
- Recent sales
- Best-selling products
- Quick actions: New Sale, Add Product, New Purchase, View Reports

Provide date filters for Today, Yesterday, This Month, and Custom Range.

**Important:** Revenue, cash collected, customer dues, and profit must be shown separately. Do not combine them into one figure.

---

## 4. Product Management

### 4.1 Product fields

| Field | Requirement |
|---|---|
| Product name | Required |
| Category | Required |
| Brand | Optional |
| Model | Optional |
| SKU / product code | Auto-generated or manually entered |
| Barcode | Optional; unique when provided |
| Purchase cost | Required |
| Selling price | Required |
| Wholesale price | Optional |
| Current stock | Calculated from stock movements |
| Minimum stock alert | Optional |
| Product image | Optional |
| Warranty period | Optional |
| Tracking type | Serial-tracked or quantity-based |
| Status | Active / inactive |

### 4.2 Default categories

- Mobile Phones
- Laptops
- Desktop Computers
- Monitors
- Printers and Scanners
- Keyboards and Mice
- Headphones and Earphones
- Chargers and Cables
- Power Banks
- Routers and Networking
- Storage Devices (SSD, HDD, Pen Drive)
- RAM and Computer Components
- Speakers
- Gaming Accessories
- Smartwatches
- Other Electronics

Admins can add, rename, or deactivate categories.

### 4.3 Product search

Support searching by:

- Product name
- SKU or barcode
- Brand and model
- IMEI or serial number

Support common USB barcode scanners that enter data like a keyboard.

### 4.4 Product and stock rules

- Negative stock is disabled by default.
- Products used in transactions must not be hard-deleted; deactivate them instead.
- Historical invoices must retain the original product description and price.
- Stock changes automatically after finalized purchases, completed sales, returns, and authorized adjustments.

---

## 5. IMEI, Serial Numbers, and Warranty

Electronics products require optional unit-level tracking.

### Requirements

- Mobile phones can have IMEI 1, optional IMEI 2, serial number, model, and warranty details.
- Laptops, desktops, monitors, and selected devices can have serial numbers and warranty dates.
- Accessories can use quantity-based inventory.
- During sale, the cashier selects an available serialized unit.
- A serialized unit cannot be sold twice.
- The sold serial/IMEI is linked to the customer and invoice.
- Invoices can display the serial number or IMEI when configured.
- Admins can search an IMEI or serial number to view purchase, sale, and warranty history.
- Warranty dates and service notes can be recorded.

A full repair-workshop system is not required for the first release.

---

## 6. POS Billing and Sales

The POS screen is the highest-priority screen and must be fast and simple.

### 6.1 Checkout workflow

1. Open **New Sale**.
2. Scan a barcode or search for a product.
3. Add products to the cart.
4. Adjust quantities and apply authorized discounts.
5. Select a customer or use Walk-in Customer.
6. Select payment method and enter the amount received.
7. Confirm the sale.
8. Update stock, payments, and customer due exactly once.
9. Print or save the invoice.

### 6.2 Required features

- Auto-generated invoice number
- Product name, quantity, unit price, discount, subtotal, and total
- Item-level and invoice-level discounts
- Optional configurable tax/VAT
- Cash, card/bank, bKash, Nagad, and mixed payments
- Full payment, partial payment, and credit/due sales
- Change calculation for cash payments
- Hold and resume an unfinished sale
- Print invoice or save as PDF
- Search, view, and reprint sales invoices
- Authorized cancellation with an audit trail
- Responsive layout for desktop, laptop, and tablet

### 6.3 Payment rules

- For mixed payments, store each payment method and amount separately.
- The sum of payments must reconcile with the amount received.
- If the customer pays less than the total, record the remaining balance as due.
- If cash received exceeds the total, calculate change; do not treat change as revenue.
- Validate all prices, quantities, discounts, and payment amounts on the backend.
- Prevent duplicate invoices caused by repeated submissions.

---

## 7. Purchase Management

Purchases record goods bought from suppliers and add stock.

### Purchase fields

- Supplier
- Supplier invoice/reference number
- Purchase date
- Product and quantity
- Unit purchase cost
- Item-level and purchase-level discount
- Total purchase amount
- Amount paid
- Remaining supplier due
- Payment method
- Optional notes and attachment

### Purchase workflow

1. Select a supplier.
2. Add products and quantities.
3. Enter purchase costs.
4. Enter the amount paid.
5. Save/finalize the purchase.
6. Increase stock and update the supplier balance.

Draft purchases must not affect stock until finalized. Support both fully paid and credit purchases.

---

## 8. Customer Management

Customer records should be optional for ordinary cash sales.

### Customer fields

- Name
- Phone number
- Address (optional)
- Total purchases
- Total payments
- Outstanding due
- Purchase history
- Warranty and serial-number history

### Features

- Quick customer creation from the POS screen
- Search by name or phone
- Customer ledger with sales, payments, returns, and balances
- Record customer due collections
- Print or export customer statements
- View all invoices for a customer

A default **Walk-in Customer** must be available so staff do not need to register every buyer.

---

## 9. Supplier Management

### Supplier fields

- Supplier name
- Company name
- Phone number
- Address
- Opening balance, if applicable
- Notes

### Features

- Purchase history
- Payments made
- Supplier outstanding balance
- Supplier ledger showing purchases, payments, returns, and resulting balance

---

## 10. Expense Management

Allow authorized users to record everyday business expenses.

### Suggested categories

- Shop rent
- Electricity and utilities
- Employee salaries
- Transport and delivery
- Internet and phone
- Repair and maintenance
- Packaging
- Other expenses

Each expense should include:

- Date
- Category
- Amount
- Payment method
- Description
- Optional receipt attachment
- User who entered the expense

Expenses must appear in cashbook and expense reports. Do not treat operating expenses as product purchase costs or subtract them directly from sales revenue.

---

## 11. Sales Returns and Warranty Lookup

### 11.1 Sales return

- Search for the original invoice.
- Select the eligible item and quantity.
- Record the return reason.
- Set the returned item's condition: restockable, damaged, or sent for repair.
- Record refund, exchange, or customer credit.
- Update stock and financial balances.
- Link the return to the original sale.
- Do not allow returns beyond the eligible sold quantity.

### 11.2 Warranty lookup

Search by invoice, IMEI, or serial number to view purchase date, customer, warranty period, and service notes. Warranty terms should be configurable.

---

## 12. Stock Management

### Features

- Current stock by product
- Stock movement history
- Low-stock alerts
- Opening stock entry during initial setup
- Authorized stock adjustment with a required reason
- Purchase stock-in and sales stock-out
- Sales returns and purchase returns
- Damaged and defective stock tracking
- Stock valuation at recorded purchase cost
- Physical stock count and discrepancy report
- CSV/Excel export

Every stock movement must record date, quantity, source transaction, and responsible user.

Stock quantities should be derived from transaction records or a controlled stock ledger, not arbitrarily overwritten totals.

---

## 13. Reports and Business Analytics

Reports must be understandable to non-accountants and include date filters.

| Report | Information |
|---|---|
| Daily sales | Sales total, transactions, discounts, returns |
| Sales by date | Daily, weekly, monthly, custom period |
| Product sales | Best-selling products and quantities |
| Gross profit | Net sales less cost of goods sold |
| Payment summary | Cash, bKash, Nagad, card, mixed payments |
| Customer due | Outstanding customer balances |
| Supplier due | Outstanding supplier balances |
| Expense report | Expenses by category and date |
| Stock report | Current quantity and stock value |
| Low-stock report | Products requiring replenishment |
| Cashbook | Cash received, paid, and closing balance |
| Salesperson report | Sales and discounts by user |

### Profit definitions

- **Net sales:** Completed sales less discounts and sales returns, according to the agreed reporting rules.
- **Cost of goods sold (COGS):** Cost of inventory sold, based on the selected inventory costing method.
- **Gross profit:** Net sales minus COGS.
- **Estimated operating profit:** Gross profit minus operating expenses.

Do not count a credit sale as cash received. Customer dues, supplier balances, and actual cash movements must be shown separately. Use a consistent costing method, such as weighted average cost, and document it.

---

## 14. Cash Register and Daily Closing

At shift start, the cashier enters opening cash. The system records cash sales, cash customer collections, refunds, and cash expenses.

At closing, display:

- Opening cash
- Cash sales
- Cash customer collections
- Other cash received
- Cash refunds
- Cash expenses
- Expected closing cash
- Actual counted cash
- Cash shortage or excess

Only authorized users can edit or reopen a closed session. Record all changes in an audit log.

---

## 15. Invoice Design and Printing

The invoice should be clear, professional, and configurable.

### Invoice content

- Shop logo and name
- Shop address and phone
- Invoice number and date
- Customer details
- Product names and quantities
- Serial number/IMEI, when applicable
- Unit prices, discounts, and totals
- Amount paid and due
- Payment method
- Warranty terms and return policy
- Optional customer and authorized signatures

### Printing requirements

- A4 invoice printing
- 80mm thermal receipt printing
- Browser print support and PDF saving
- No clipped text or missing rows
- Long product names and multiple invoice pages handled correctly
- Reprint an invoice without changing the underlying sale

---

## 16. Settings

Keep settings in one straightforward page.

- Shop name, logo, address, and contact number
- Currency: BDT (৳)
- Time zone: Asia/Dhaka
- Date format
- Invoice numbering and design
- Product categories
- Tax/VAT configuration
- Default warranty terms
- Low-stock thresholds
- User accounts and permissions
- Payment methods
- Backup and restore
- Password change

Tax/VAT settings must be configurable and should not have an unsupported rate hard-coded into the software.

---

## 17. User Interface and Navigation

### Design principles

- Clean, modern, uncluttered interface
- Readable fonts and clear button labels
- Consistent spacing and familiar icons
- Few clicks for common tasks
- Sensible defaults
- Inline validation and helpful error messages
- Avoid unnecessary pop-ups and technical language
- Keyboard-friendly POS workflow
- Responsive desktop, laptop, and tablet layouts

### Main navigation

1. Dashboard
2. **New Sale** (prominent)
3. Sales History
4. Products
5. Stock
6. Purchases
7. Customers
8. Suppliers
9. Expenses
10. Reports
11. Cash Register
12. Users & Settings

---

## 18. Recommended Technical Architecture

This is a recommended stack, not a requirement to replace an existing suitable architecture.

| Component | Recommendation |
|---|---|
| Frontend | HTML/CSS/JavaScript or React |
| Backend | Node.js and Express |
| Database | MongoDB Atlas |
| API | REST API |
| Authentication | Secure sessions or appropriately implemented token authentication |
| Password storage | Strong salted password hashes |
| Invoice | Print-friendly HTML and reliable PDF generation |
| Hosting | HTTPS-enabled cloud server or VPS |
| Backup | Automated database backups and tested exports |

### Core data entities

- Users and roles
- Products and categories
- Serialized units / IMEIs
- Stock movements
- Suppliers and purchases
- Customers and sales
- Payments and refunds
- Expenses
- Cash-register sessions
- Warranty records
- Audit logs
- Shop settings

### Data integrity and security

- Use stable IDs and consistent references.
- Store money using integer minor units where appropriate or a reliable decimal-money representation; avoid floating-point money calculations.
- Use database transactions or equivalent consistency controls when finalizing sales, purchases, payments, and stock movements.
- Validate input and permissions on the server.
- Keep an audit trail for cancellations and sensitive edits.
- Use HTTPS and secure session handling.
- Do not store raw payment credentials or unnecessary card details.
- Back up data regularly and test restoration.

### Internet and printing

The first release is an online application. Support common USB and network thermal printers through browser printing or a compatible print bridge.

Full offline billing and synchronization are deferred because they introduce risks involving duplicate sales and conflicting stock.

---

## 19. Core Business Rules

1. A completed sale decreases stock exactly once.
2. A finalized purchase increases stock exactly once.
3. A partial payment leaves the correct outstanding balance.
4. A customer payment reduces customer due but does not create a new sale.
5. A supplier payment reduces supplier due but does not create a new purchase.
6. Returns reverse the appropriate stock and financial effects.
7. A serialized device cannot be sold twice.
8. Invoice edits preserve an audit trail and correctly recalculate related records.
9. Discounts cannot exceed configured permissions or limits.
10. Only authorized users can cancel sales, change purchase costs, or adjust stock.
11. Reports use consistent definitions for revenue, collections, expenses, and profit.
12. Historical invoices retain the original product descriptions and prices.
13. Draft transactions do not affect final stock or balances.
14. Every financial or stock-affecting operation must be idempotent or protected against duplicate submission.
15. Refunds and returns must be traceable to the original transaction.

---

## 20. MVP Delivery Phases

### Phase 1 — Essential POS

- Login and roles
- Dashboard
- Product categories and products
- Barcode/product search
- POS cart and billing
- Invoices
- Payment collection and due sales
- Basic stock tracking
- Sales history and daily sales report

### Phase 2 — Shop Management

- Purchases and suppliers
- Customer due and collections
- Expenses
- Sales returns
- Stock adjustments and low-stock alerts
- Cash register and daily closing
- Gross profit and expense reports

### Phase 3 — Electronics Specialization

- IMEI and serial-number tracking
- Warranty history and lookup
- Device-level invoice details
- Warranty information on printed invoices

### Phase 4 — Optional Enhancements

Only after the core system is stable:

- WhatsApp invoice sharing
- Customer loyalty features
- Multiple branches
- Repair-workshop management
- Supplier reorder suggestions
- Offline mode and synchronization
- Advanced analytics

---

## 21. Out of Scope for the First Release

To keep the application simple, do not include these in the initial version:

- Complex double-entry accounting screens
- Manufacturing or bill of materials
- Payroll and attendance
- Multi-tenant ERP administration
- Complicated warehouse transfers
- Advanced procurement approval workflows
- Full CRM and marketing automation
- AI forecasting
- Mandatory payment-gateway integration

Add these only when there is a clear business need and the core POS is stable.

---

## 22. Acceptance Criteria

The first release is ready when all of these are tested successfully:

- Admin can create products with cost, selling price, category, and opening stock.
- Cashier can scan or search a product and complete a sale.
- Stock decreases correctly and only once after a completed sale.
- Invoice prints correctly on A4 and 80mm thermal printers.
- Cash, mobile payment, card, mixed, partial, and due sales reconcile correctly.
- A purchase increases stock and updates supplier balances correctly.
- Customer collections reduce due without creating duplicate sales.
- Returns update inventory and financial balances correctly.
- IMEI/serial tracking prevents the same device being sold twice.
- Daily sales, gross profit, expenses, cashbook, and stock reports reconcile with transaction records.
- Users cannot access restricted actions.
- Repeated submissions do not create duplicate invoices, payments, or stock movements.
- Backup and restore procedures are tested.
- A new cashier can learn the core sales workflow with minimal instruction.

---

## 23. Developer Implementation Instructions

Use this PRD as the functional specification.

Before coding:

1. Inspect the existing project, database, and current features if a project already exists.
2. Prepare a concise implementation plan.
3. Define data models, API endpoints, permissions, and transaction rules.
4. Identify risks to existing data and functionality.
5. Implement one module at a time, beginning with the POS workflow.

During development:

- Do not replace working modules unnecessarily.
- Preserve existing data and APIs unless a change is required and planned.
- Use migrations or backward-compatible changes where appropriate.
- Validate inputs on both client and server.
- Add tests for stock, payments, returns, invoice generation, permissions, and profit calculations.
- Verify A4 and thermal printing before release.
- Provide clear setup instructions and a documented backup/restore process.

### Final product principle

Build the POS billing screen first and make it excellent. Every other module should support the daily workflow of adding products, selling them, collecting money, and understanding stock and profit. Keep the application simple enough for shop employees with basic computer skills.
