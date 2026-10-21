# Tape Factory Stock Management System (MES & Inventory)

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-teal?logo=prisma)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0_Aiven-orange?logo=mysql)](https://aiven.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-sky?logo=tailwind-css)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Vitest-16_Passed-emerald?logo=vitest)](https://vitest.dev/)

An enterprise-grade, full-stack Manufacturing Execution System (MES) and Inventory Management System designed for precision adhesive tape manufacturing. Engineered for strict inventory integrity, zero negative stock, exact Bill of Materials (BOM) mass-balance verification, atomic reservation management, and immutable audit trails.

---

## Table of Contents
1. [Core Features & Business Logic](#core-features--business-logic)
2. [BOM Formulas & Mass-Balance Tolerance](#bom-formulas--mass-balance-tolerance)
3. [Technology Stack](#technology-stack)
4. [Aiven MySQL Database Setup](#aiven-mysql-database-setup)
5. [Demo Credentials & Permissions (RBAC)](#demo-credentials--permissions-rbac)
6. [Getting Started (Run & Build Commands)](#getting-started-run--build-commands)
7. [Automated Test Suite](#automated-test-suite)
8. [Database Schema & Architecture](#database-schema--architecture)
9. [Security & Idempotency Engineering](#security--idempotency-engineering)
10. [Known Limitations & Future Roadmap](#known-limitations--future-roadmap)

---

## 1. Core Features & Business Logic

- **Role-Based Access Control (RBAC):** Strict server-side permission gating distinguishing `ADMIN` and `STAFF`. Staff attempting Admin-only corrections receive an automated HTTP 403 Forbidden.
- **Tape Specifications & Immutability:** Fully customizable technical parameters (width, film GSM, dry coating GSM, adhesive solids %, roll length). Once a specification has been used in production, it is permanently locked and immutable. Versioning creates a linked specification (e.g., `SPEC-001-v2`), preserving all batch historical data.
- **Append-Only Material Ledger:** Raw materials (Film in kg, Liquid Adhesive in kg, Paper Cores in pcs) start at zero. All receipts, production issues, and damage scraps are append-only. Negative stock is strictly rejected with exact shortage reporting.
- **Production Mass Balance Enforcement:** Validates expected BOM input against physical material issues and declared dry wastage. Batches with mass discrepancies exceeding the documented precision tolerance ($\pm 0.050\text{ kg}$) are rejected to prevent phantom scrap or unrecorded material loss.
- **Atomic Stock Deductions:** Every production batch executes within a single database transaction: raw materials are decremented, cores are deducted, finished whole rolls are credited, and the specification is locked. If any raw material is insufficient, the transaction rolls back completely.
- **Flexible Order Units with Whole-Roll Guarding:** Customers can place orders in **Rolls**, **Metres**, or **Net Tape Kg**. The system strictly validates whole-roll equivalents without silent rounding and suggests valid alternatives if the input does not represent an exact whole roll.
- **Atomic Stock Reservations:** Confirmed sales orders atomically reserve finished goods to prevent overselling under concurrent requests.
- **Partial & Full Dispatches:** Dispatches credit customer shipments and debit physical finished stock, never exceeding the unshipped order balance.
- **Order Cancellation & Reservation Release:** Cancelling an order releases only the remaining unshipped reservation back to available warehouse stock.
- **Certified Admin Corrections:** Requires a mandatory explanation ($\ge 10\text{ characters}$). Modifies stock via offsetting ledger entries and rejects adjustments that would produce negative balances or breach customer reservations.
- **Full Audit Trail:** All critical operations record user identity, role, IP address, timestamp, and structured change payloads.

---

## 2. BOM Formulas & Mass-Balance Tolerance

All calculations utilize **Decimal arithmetic** (`decimal.js` with 28-digit precision) to eliminate binary floating-point drift. Display weights are formatted to 3 decimal places without display-rounded values ever corrupting ledger calculations.

### Standard Formulas (for any positive whole roll count):
$$
\text{areaM2} = \left(\frac{\text{widthMm}}{1000}\right) \times \text{rollLengthM} \times \text{rollCount}
$$
$$
\text{filmKg} = \frac{\text{areaM2} \times \text{filmGSM}}{1000}
$$
$$
\text{dryAdhesiveKg} = \frac{\text{areaM2} \times \text{dryCoatingGSM}}{1000}
$$
$$
\text{liquidAdhesiveKg} = \frac{\text{dryAdhesiveKg}}{\frac{\text{solidsPercentage}}{100}}
$$
$$
\text{cores} = \text{rollCount} \quad (\text{exactly 1 core per roll})
$$
$$
\text{netTapeKg} = \text{filmKg} + \text{dryAdhesiveKg}
$$
$$
\text{actualDryAdhesiveKg} = \text{liquidAdhesiveIssuedKg} \times \frac{\text{solidsPercentage}}{100}
$$

### Production Mass-Balance Verification:
$$
\text{productionInputKg} = \text{actualFilmIssuedKg} + \text{actualDryAdhesiveKg}
$$
$$
\text{netTapeProducedKg} = \text{expectedFilmKg} + \text{expectedDryAdhesiveKg}
$$
$$
\text{productionOutputKg} = \text{netTapeProducedKg} + \text{dryWastageKg}
$$
$$
\text{productionDifferenceKg} = \text{productionInputKg} - \text{productionOutputKg}
$$

> **Precision Policy:** Production batches are rejected if $|\text{productionDifferenceKg}| > 0.050\text{ kg}$ (50 grams tolerance).

### Standard Dummy Specification Reference:
- Width: $48\text{ mm}$
- Film GSM: $25\text{ GSM}$
- Dry Coating GSM: $22\text{ GSM}$
- Adhesive Solids: $50\%$
- Roll Length: $1,000\text{ metres}$
- **Per Roll Yield:**
  - Area: $48.00\text{ m}^2$
  - Film: $1.200\text{ kg}$
  - Dry Adhesive: $1.056\text{ kg}$
  - Liquid Adhesive: $2.112\text{ kg}$
  - Cores: $1\text{ piece}$
  - Net Tape Weight: $2.256\text{ kg}$

---

## 3. Technology Stack

- **Framework:** Next.js 14 (App Router, Server Actions & Route Handlers)
- **Frontend:** React 18, Tailwind CSS, Lucide React icons
- **Language:** TypeScript 5.6 (strict mode enabled)
- **ORM:** Prisma Client 5.22
- **Database:** MySQL 8.0 (Aiven Cloud Managed MySQL with SSL)
- **Precision Arithmetic:** Decimal.js
- **Validation:** Zod
- **Authentication:** HMAC-SHA256 Signed JWT Cookies (`jose`), `bcryptjs` (cost factor 12)
- **Testing:** Vitest 2.1 (Unit & Integration tests)

---

## 4. Aiven MySQL Database Setup

1. Copy `.env.example` to create your local `.env`:
   ```bash
   cp .env.example .env
   ```
2. Enter your secure Aiven MySQL connection URL in `.env`:
   ```env
   MYSQL_DATABASE_URL="mysql://avnadmin:YOUR_AIVEN_PASSWORD@mysql-1e4e4e40-nikkichaubey10-eddc.e.aivencloud.com:21245/defaultdb?ssl-mode=REQUIRED"
   SESSION_SECRET="tape_factory_super_secure_jwt_session_secret_key_2026_production"
   NODE_ENV="development"
   ```
   > **Note:** Aiven requires SSL mode `REQUIRED`. Ensure `.env` is ignored by git (`.gitignore` already includes it).

3. Push the schema to MySQL and generate Prisma Client:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Seed the database with demo users, standard specification, and customers:
   ```bash
   npm run prisma:seed
   ```

---

## 5. Demo Credentials & Permissions (RBAC)

| Account Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@tape.local` | `AdminDemo@2026` | Full access: specifications, stock receipts, production, order management, dispatches, and **Admin Stock Corrections** |
| **Staff** | `staff@tape.local` | `StaffDemo@2026` | Stock & specifications viewing, material receipt, production recording, order creation, dispatches. **Blocked from Admin Corrections (HTTP 403)** |

*Assessment Convenience:* The login page provides one-click autofill buttons for both Admin and Staff accounts.

---

## 6. Getting Started (Run & Build Commands)

### Install Dependencies:
```bash
npm install
```

### Start Development Server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Run Production Build:
```bash
npm run build
npm start
```

---

## 7. Automated Test Suite

The test suite thoroughly covers all 16 business requirement cases:
- BOM formulas & multi-roll scaling
- Variable specification dimensions & GSMs
- Rejection of invalid roll counts (0, negative, fractional)
- Adhesive solids limits ($>0\%$ and $\le 100\%$)
- Mass balance within tolerance acceptance
- Mass balance mismatch rejection
- Extra wastage consumption verification
- Order unit validation in Rolls, Metres (multiples), and Net Kg (formula matching)
- Non-rounded alternative suggestions
- Staff 403 Forbidden enforcement on Admin corrections
- Mandatory correction justification ($\ge 10\text{ characters}$)
- Decimal precision without floating point drift
- Idempotency key handling

Run tests via Vitest:
```bash
npm test
```

---

## 8. Database Schema & Architecture

The database schema is fully normalized and implemented in Prisma (`prisma/schema.prisma`):

- `users`: Authentication records, bcrypt hashed credentials, and role assignments (`ADMIN`, `STAFF`).
- `tape_specifications`: Immutable manufacturing recipes with version tracking and usage locks.
- `material_ledger`: Append-only raw material log (`FILM`, `LIQUID_ADHESIVE`, `CORE`).
- `production_batches`: Mass-balance records, expected vs actual inputs, dry wastage, and differences.
- `finished_goods_ledger`: Finished whole roll inventory tracking with derived metres and net kg.
- `customers`: Corporate customer directory.
- `sales_orders`: Order quantities in Rolls, Metres, or Net Kg; reservation tracking.
- `order_reservations`: Atomic inventory reservation pool.
- `dispatches`: Partial and full shipment logs with gate pass notes.
- `cancellations`: Records cancelled unshipped balances and releases reservations.
- `correction_records`: Admin audit records capturing prior state, correction state, and mandatory reason.
- `audit_logs`: Immutable operation history.
- `idempotency_keys`: Unique request caching table preventing duplicate actions.

---

## 9. Security & Idempotency Engineering

1. **Idempotency Keys:** Mutating API endpoints (`/api/orders`, `/api/production`, `/api/inventory/materials`) accept an `x-idempotency-key` header. Duplicate submissions (from double-clicks or network retries) return the cached response without re-executing transactions.
2. **Interactive DB Transactions:** Multi-record workflows execute in `prisma.$transaction`, ensuring atomic commit or complete rollback upon inventory shortage.
3. **Session Cookies:** Signed JSON Web Tokens (JWT) stored in `HttpOnly`, `SameSite=Lax`, secure cookies.
4. **Server-Side Validation:** Every request is validated against strict Zod schemas before hitting the database.

---

## 10. Known Limitations & Future Roadmap

- **Barcode Scanning:** Current dispatches are recorded through web UI forms; mobile camera barcode scanning can be integrated via WebRTC.
- **Automated Reordering:** Low-stock threshold triggers currently display visually on the dashboard; webhook-based supplier purchase order creation can be added.
