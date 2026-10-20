# Master Build Prompt — Factory OS Marketplace

Use the following prompt with a coding agent that has access to the Factory OS repository.

---

You are a principal product engineer and marketplace architect working inside the existing Factory OS repository.

Build a production-grade multi-tenant marketplace connected directly to Factory OS. The platform has three surfaces:

1. A public buyer marketplace where customers can register, browse/search products from multiple factories, add offers to a cart, checkout, pay, track shipments, cancel eligible orders, request returns and submit RFQs.
2. A seller experience inside Factory OS where factory owners register, complete business verification, publish buyer-safe listings, manage stock and price, receive their marketplace orders, convert made-to-order items into work orders, perform QC, dispatch, handle returns and view settlements.
3. An operator console where marketplace staff approve sellers and listings, configure commissions, monitor orders/payments, manage risk, disputes and settlements, and inspect audit logs.

Read `docs/MARKETPLACE_SYSTEM_DESIGN.md` completely before planning or editing. Inspect the current repository and reuse its catalog, Firebase, inventory, work-order, QC, dispatch, billing and payment foundations. Do not replace working modules without evidence.

## Non-negotiable domain model

- Separate canonical Product from seller Listing.
- Listing owns seller/factory/location, seller SKU, price slabs, stock, MOQ, tax and dispatch SLA.
- One buyer checkout creates one parent Order.
- Split the parent order into one SellerOrder per legal seller/GST registration.
- Split each SellerOrder into FulfilmentOrders per factory/location, then operate pick/pack/dispatch at Shipment level.
- Maintain item-level cancellations, returns, refunds, fees and settlement lines.
- Never expose private BOM, cost, vendors, payroll or operational notes in the public catalog.

## Non-negotiable reliability rules

- Every mutating API must accept a bounded idempotency key.
- Server must recalculate price, tax, seller eligibility and stock.
- Reserve inventory transactionally and release it through expiry or compensation.
- Store signed payment/logistics webhooks in an inbox before processing.
- Use monotonic order and payment state transitions.
- Use a transactional outbox for seller-order, notification, inventory and accounting events.
- Do not call external providers inside database transactions.
- Treat provider timeouts and 5xx responses as ambiguous; reconcile before retrying.
- Ledger entries are append-only and use integer paise amounts.
- A seller can read and mutate only its own organization, factory, listings, orders, shipments and settlement views.
- PostgreSQL is the sole authority for checkout, order, payment, inventory reservation, ledger, return and settlement state. Commit domain changes and outbox events atomically in the same database; do not dual-write financial state to Firestore.

## Security requirements

- Replace environment-selected factory identity with authenticated organization membership.
- Use MFA for owners, finance users and operator admins.
- Store KYC/bank documents outside public-readable collections and encrypt sensitive fields.
- Enforce role and tenant authorization server-side and in database/storage rules.
- Validate all uploads, use signed URLs and scan untrusted documents.
- Rate-limit signup, login, search, cart, checkout and webhook endpoints.
- Keep secrets in Secret Manager; provide `.env.example` with placeholders only.
- Add immutable audit events for sensitive operations.
- Use scoped operator RBAC and maker-checker approval for bank changes, manual refunds, commission changes and settlement release; global admin alone is insufficient.

## Execution method

1. Audit the current repository and list reusable modules and blockers.
2. Produce an ADR-backed, dependency-ordered implementation plan in thin vertical slices.
3. Do not implement all phases in one change. Complete one deployable slice at a time.
4. For every slice use test-driven development: failing regression/contract test, implementation, refactor, security review and verification.
5. Preserve unrelated working-tree changes.
6. Do not commit, push or deploy until the human explicitly approves the corresponding gate.

## Required phases

### Phase 0 — Foundation hardening

- Write and obtain approval for Merchant-of-Record, contracting-party, invoice/credit-note issuer, GST/TCS/TDS, payment funds-flow, refund/chargeback liability and settlement-policy ADRs. Keep real checkout disabled until approved by qualified legal/tax/payment stakeholders.
- Establish PostgreSQL as the order/financial system of record, with an atomic transactional outbox.
- Define the versioned migration from existing single-factory Firestore orders: separate v2 parent/seller/fulfilment models, projection namespaces, shadow comparison, feature-flag cutover and rollback. Never expose parent orders to sellers and never dual-write authoritative financial state.
- Production Firebase configuration and authenticated tenant selection.
- Payment order/refund reconciliation and race-safe webhook handling.
- CI for typecheck, unit tests, rules tests, dependency audit and production build.
- Structured logs, health checks, error monitoring and rollback runbook.

### Phase 1 — Seller onboarding

- Organization/factory creation.
- Email/mobile verification.
- Business, GST/PAN, bank and pickup-location forms.
- Seller application state machine.
- Operator review and approval.
- Seller agreement/version acceptance and audit log.

### Phase 2 — Catalog and listings

- Category taxonomy and attribute definitions.
- Canonical products and variants.
- Factory listings with price slabs, MOQ, stock, tax, lead time and media.
- Draft/review/approved/rejected/suspended lifecycle.
- Public catalog projection and search indexing.

### Phase 3 — Buyer storefront

- Browse, category, search, product and seller pages.
- Buyer account, addresses and GST invoice profile.
- Multi-factory cart and server-side price quote.
- Accessible responsive UX with loading, empty and error states.

### Phase 4 — Checkout and order orchestration

- Checkout session and expiring inventory reservations.
- Razorpay payment intent with verified webhooks.
- Parent order, legal-seller order, factory/location fulfilment order and order items.
- Exactly-once FulfilmentOrder projection into the assigned Factory OS workspace.
- Buyer confirmation and seller notification.

### Phase 5 — Factory execution

- Marketplace order inbox in Factory OS.
- Ready-stock versus made-to-order routing.
- Work order, QC, invoice, pack and dispatch integration.
- Shipment/AWB/tracking updates reflected to buyer.

### Phase 6 — Reverse commerce

- Policy-driven cancellation.
- Return/replacement workflow and reverse pickup.
- Refund state machine and credit notes.
- Disputes and support timeline.

### Phase 7 — Finance and settlements

- Commission and fee rule versions.
- Double-entry marketplace ledger.
- Seller payable calculation at order-item level.
- Settlement batches, reconciliation and seller statements.
- GST/TCS/TDS-ready reporting boundaries, subject to professional tax validation.
- Run a shadow ledger first. Do not release real settlements until authoritative delivery and return-window events from Phases 5 and 6 are live and reconciled.

### Phase 8 — Operator and automation

- Seller/listing moderation queues.
- Order/payment/refund exception queues.
- Commission and category configuration.
- Signed outbound event subscriptions compatible with Zapier-style automation.
- Retry, dead-letter and delivery audit views.

## Required verification for every phase

- Typecheck and production build.
- Unit and contract tests.
- Firebase emulator or database integration tests for tenant isolation.
- Negative authorization tests.
- Concurrency/idempotency tests for inventory and payments.
- Accessibility and responsive browser checks.
- Dependency and secret scan.
- Migration, rollback and operational notes.

## Definition of done for marketplace MVP

A newly approved factory owner can publish a listing; a buyer can find it, purchase it in a cart that may include another factory, complete payment once, and receive a Parent Order confirmation. The platform creates a SellerOrder per legal seller/GST registration and a FulfilmentOrder per assigned factory/location. Each factory sees only its FulfilmentOrder in Factory OS, processes it through stock/production, QC and dispatch, and the buyer sees unified Shipment tracking. Cancellation/refund and seller payable remain correct under retries, duplicate webhooks and partial failures. Operator staff can investigate every state change through an audit trail.

Start by producing the repository audit and dependency-ordered plan. Do not write implementation code until that plan is reviewed.

---

## Suggested first implementation prompt

Implement Phase 0 only. First draft and obtain explicit stakeholder approval for the Merchant-of-Record, invoice/tax, payment funds-flow, refund liability and settlement ADRs. Next define PostgreSQL as the authoritative order/financial database and approve the versioned Firestore-to-PostgreSQL migration, projection, cutover and rollback plan. If these approvals are unavailable, stop and report the blocker; do not enable real checkout. After approval, reproduce the known legacy payment and tenant-selection risks as tests, then harden them only as required for safe operation and migration: production Firebase tenant selection, ambiguous payment/refund reconciliation, monotonic webhook transitions and CI verification. Preserve unrelated changes. Stop before commit and provide the ADR status, security-review findings, test results, migration impact and proposed conventional commit message.
