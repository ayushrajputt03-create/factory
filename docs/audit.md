# Factory OS Audit — 2026-10-03

## Verified baseline

- Stack: React 19 + TypeScript + Vite. The app is a single `src/App.tsx` shell with view switching and nested CRM/Accounts tabs rather than a router package.
- Data mode: browser `localStorage` through `src/lib/mockStore.ts`; `src/lib/dataService.ts` is the service boundary, but no Firebase client or Firestore adapter is present in the repository.
- Navigation/views: Command Center, Production, Work Orders, Machines, Inventory, QC, Dispatch, BOM, Billing, Clients, CRM, Accounts, Reports, Notices and Setup. CRM and Accounts also have URL-synchronised nested tabs.
- State: top-level React state owns the primary collections and passes them to feature views. Several feature actions update the top-level state directly; the service is used by production, inventory, machines, QC, clients and setup flows.
- Tests: `npm test -- --run` currently passes 17 tests across 3 files. Coverage is focused on CRM helpers and finance calculation primitives; UI flows and `dataService` are not covered by integration tests.

## Architecture findings

- No UI component imports `mockStore` directly; the only direct import outside the store is the accounts-engine test.
- `dataService` currently exposes synchronous local/demo methods. Firebase and Supabase references are TODO comments only.
- Invoice creation in `App.tsx` computes totals and directly updates React state; it does not route through `dataService`, does not create a payment entity, and does not persist through `mockStore`.
- Invoice and ledger totals are represented in rupees as regular numbers in the current demo types. Integer-paise storage is not implemented.
- CRM leads are a separate browser-local state collection in `CrmFoundationView`, persisted under its own localStorage key, rather than a `dataService` entity.

## Working areas

- Production records create finished stock and BOM-based stock deductions.
- Manual stock movements, BOM versioning, work orders, breakdown tickets, QC inspections, clients, interactions, follow-ups and expenses have demo-mode service methods.
- CRM supports search, owner/source filtering, lead creation, local persistence, CSV export, pipeline cards and a detail drawer.
- Accounts dashboard includes receivables, payables, expenses, cash/bank, costing, payroll placeholder, ledger, tax and reports views.
- SPA deep links have a Vercel rewrite and production URL returns HTTP 200.

## Verified risks and gaps

1. No real authentication, protected routes, Firebase Auth, Firestore persistence, multi-user sync or server-side role enforcement.
2. Invoice creation is not transactional and invoice numbers are generated from array length; concurrent users can collide in a future backend.
3. Payment allocation, credit notes, invoice cancellation, invoice detail view, PDF generation and receipt generation are absent or incomplete.
4. GST calculation is basic and does not model intra-state CGST/SGST versus inter-state IGST in a pure calculation service.
5. Production and stock validation was previously permissive; invalid quantities could be accepted and stock-out could silently clamp to zero. These guards are now fixed in `dataService`.
6. Finance tables contain dead-end Filters/Export/overflow actions in some screens and need wiring to real controls.
7. User management, audit logs, force logout, employee/HR and gate-pass modules are not implemented.
8. `supabase/schema.sql` is a secondary Postgres design, while the requested architecture is Firebase; it is not connected to the application and should not be treated as runtime evidence.

## Recommended delivery order

1. Extract a pure invoice/payment calculation engine with paise-safe arithmetic and tests.
2. Move invoice creation and payments behind the service boundary while retaining the demo adapter.
3. Add invoice detail, payment allocation, cancellation/credit-note rules and print/PDF output.
4. Add Firebase Auth/Firestore adapters, security rules and audit logs behind `VITE_DATA_MODE`.
5. Add role tests and interactive route/flow tests before enabling production mode.
