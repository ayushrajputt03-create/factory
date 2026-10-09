# Factory OS CRM implementation blueprint

## Current architecture

- The existing Factory OS is a React 19, TypeScript and Vite single-page application (`src/App.tsx`) with custom CSS in `src/styles.css`. Navigation is a union type and manual `history.pushState` routing, not React Router.
- The current product shell, top bar, sidebar, tables, badges, drawers, toast messaging and mobile navigation are all implemented in `src/App.tsx` and `src/styles.css`. Reuse these patterns before introducing a component library.
- Operational data is primarily seeded/in-browser state. `src/seed.ts` holds demo data; `src/lib/dataService.ts` delegates many mutations to local browser storage through `src/lib/mockStore.ts`.
- Firebase client initialization exists in `src/lib/firebaseClient.ts`; Firestore and Auth SDKs are configured. The main shell still lacks a login/onboarding screen, but Phase 1 can consume existing ID-token claims without inventing a second identity system. HR is the only partial Firebase persistence path, using Realtime Database in `HrCompleteView` within `src/App.tsx`.
- Firebase Functions live in `functions/src`. Existing uncommitted work contains catalog, payment, admin, RFQ, WhatsApp and reseller Functions. Treat it as provisional until reviewed, committed, tested and deployed.
- Hosting configuration is Vercel (`vercel.json`); Firebase configuration and rules are in `firebase.json`, `firestore.rules`, `storage.rules` and `database.rules.json`.

## Verified reusable modules

| Need | Existing evidence | CRM adaptation |
| --- | --- | --- |
| Client/customer master | `ClientsCrmView` in `src/App.tsx`; client records in `src/lib/dataService.ts` | Extend this source of truth; do not create a parallel account master. |
| CRM dashboard | legacy `CrmFoundationView` in `src/App.tsx` | Do not treat its localStorage leads or hardcoded KPIs as authoritative. Phase 1 replaces its route with `src/crm/CrmModule.tsx`; later phases can remove the dead prototype after migration. |
| Finance/credit | `AccountsFinanceView`, `BillingView`, `financeEngine.ts` | Read invoices, ledger and outstanding values; CRM never posts accounting entries. |
| Products/BOM | `SetupView`, `BomView`, `types.ts` | Reference existing product/BOM identifiers for requirements and costing. |
| Work orders/dispatch | `WorkOrdersView`, `DispatchView` | CRM handoff should link IDs, not copy operational documents. |
| Notifications | Toast state in `App.tsx`; factory notification documents in Functions | Add a shared notification repository only after authentication and Firestore migration. |
| UI building blocks | `.panel`, `.badge`, `.form-control`, drawers, tables in `src/styles.css` | Keep information-dense ERP visual language and existing Lucide icons. |

## Critical adaptation decisions

1. The proposed relational-style CRM tables become Firestore collections under `factories/{factoryId}/crm/*`; global marketplace records remain top-level only when genuinely public/shared.
2. Phase 1 consumes Firebase ID-token claims (`active`, `factory_id`, `role`, optional `crm_access`, `crm_permissions`, `crm_scope`). The current role selector remains demo-only when Firebase is not configured and is never a production security boundary.
3. `dataService`/localStorage is unsuitable for CRM production records, server pagination, audit history, tenant isolation and exports. Build a repository interface and Firestore implementation before CRM writes.
4. Current Firestore rules rely on custom claims (`active`, `factory_id`, `role`) but no user onboarding/claim setter is present. This does not block the read-only Phase 1 shell; an administrator claim-management workflow is required before ordinary sales users can be provisioned.
5. No queue, email provider, search index, document/PDF provider or E2E framework is currently established. CRM phases must use provider interfaces and defer real external delivery until configured.

## Proposed CRM model

Private records use `factories/{factoryId}/crm/`:

```text
leads/{leadId}
accounts/{accountId}
contacts/{contactId}
activities/{activityId}
opportunities/{opportunityId}
opportunities/{opportunityId}/stageHistory/{historyId}
rfqs/{rfqId}
quotations/{quotationId}
quotations/{quotationId}/versions/{versionId}
savedViews/{viewId}
auditEvents/{eventId}
```

Every document needs `factoryId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, status and a soft-delete field where relevant. Monetary values use integer paise plus `currency`. Normalized duplicate keys (`phoneNormalized`, `emailLower`, `gstinNormalized`) are written and validated server-side. Immutable history and approvals are subcollections written only by Functions.

## Authorization model

- Roles: owner, plant_manager, supervisor, operator, storekeeper, qc_inspector, accountant, logistics plus planned sales roles.
- Claims/rules enforce factory membership; Functions enforce operation scope and data validation.
- Permission keys use `crm.<section>.<action>` and scopes use `own`, `team`, `plant`, `all`. Owners and plant managers receive safe plant-scope access; ordinary roles require explicit claims and receive no automatic elevation. Team/record filtering becomes enforceable when those ownership fields land with the Leads model.
- UI guards are usability only. Direct Firestore writes for commercial state transitions are denied; callable Functions perform assignment, merge, conversion, approvals, quote acceptance and handoff.

## Routes and navigation

Within the current manual router, add views only after a CRM route registry is extracted:

```text
/crm                 Overview
/crm/leads           Leads
/crm/accounts        Accounts
/crm/contacts        Contacts
/crm/opportunities   Opportunities
/crm/rfqs            RFQs
/crm/quotations      Quotations
/crm/activities      Activities
/crm/reports         Reports
```

The existing `/crm` prototype is retained as dead code temporarily to avoid a risky unrelated deletion, while the registered route renders the guarded foundation. `VITE_CRM_ENABLED=false` removes the navigation entry; direct URL access still reaches the permission guard.

## Phase 1 contracts implemented

- `src/crm/foundation.ts` is the single route and permission registry for the module.
- `src/crm/useCrmPrincipal.ts` converts Firebase token claims into a UI principal. With no Firebase configuration it exposes the existing role selector as an explicitly non-production demo principal.
- `src/crm/CrmModule.tsx` supplies the shared module header, responsive sub-navigation, empty/loading/error/permission-denied states, status-with-text treatment and a module error boundary.
- `firestore.rules` grants CRM reads only inside the caller's claimed factory to owners, plant managers or users with explicit `crm_access`; all CRM client writes remain denied until collection-specific Phase 2 validation exists.
- `tests/firestore/crm.rules.test.mjs` covers safe defaults, cross-tenant denial, ordinary-role denial, explicit access and write denial.

## API/event contracts

- Callable Functions: `createLead`, `updateLead`, `assignLead`, `mergeLeads`, `transitionOpportunity`, `createQuotationVersion`, `acceptQuotation`, `createSalesOrderFromQuote`.
- Events use immutable IDs and idempotency records: `crm.lead.created`, `crm.lead.assigned`, `crm.opportunity.stage_changed`, `crm.rfq.submitted`, `crm.quotation.accepted`.
- Function consumers write an audit event and a de-duplication document in one Firestore transaction.
- Files use Firebase Storage paths scoped to `factories/{factoryId}/crm/...` and Storage rules validate membership and content type.

## Migration sequence

1. **Foundation:** implement AuthContext, memberships, claims administration, permission map, Firestore repositories and emulator availability.
2. **CRM shell:** feature flag, route registry, page header, guarded navigation and error/empty/loading states.
3. **Leads:** Firestore-backed vertical slice with audit history, duplicate checks and CSV workflow.
4. **Accounts/contacts:** extend existing client records, then customer 360 read models.
5. **Activities/opportunities:** server transition validation and pipeline history.
6. **Manufacturing CRM:** RFQ, costing, quote versions and sales-order handoff.
7. **Visibility/reporting:** dispatch, invoice, collection and service read models.

All documents must retain backward-compatible optional fields; do not delete seeded/local structures until migrated data and rollback behavior are verified.

## File-level phase plan

| Phase | Planned files |
| --- | --- |
| 0 | `docs/crm/implementation-blueprint.md` only |
| 1 | `src/crm/foundation.ts`, `src/crm/useCrmPrincipal.ts`, `src/crm/CrmModule.tsx`, `src/App.tsx`, `src/styles.css`, `firestore.rules`, `tests/firestore/crm.rules.test.mjs` |
| 2 | `functions/src/crmLeads.ts`, `src/crm/leads/*`, `src/lib/crmRepository.ts`, `tests/*` |
| 3–5 | `src/crm/accounts/*`, `src/crm/activities/*`, `src/crm/opportunities/*`, matching Functions/rules/tests |
| 6–8 | `src/crm/rfq/*`, `src/crm/quotations/*`, Functions adapters to existing product/order modules |

## Risks and required product decisions

- Select Firestore document shapes and indexes before list/search implementation; Firestore does not support relational joins.
- Define whether sales users are factory members, marketplace users, or both.
- Decide quote numbering, approval thresholds, allowed manual price overrides and GST/document format.
- Confirm source of truth for existing `Party` versus new account/contact concepts.
- Firebase rules tests require the Firestore emulator and Java; keep this as an explicit release gate if the local toolchain cannot start it.
- The working tree has extensive uncommitted cross-module changes. Commit/review or isolate them before Phase 1 to avoid mixing release scope.

## Test strategy and definition of done

- Unit-test validation, duplicate matching, money/tax calculations and permitted state transitions.
- Emulator-test factory isolation, own/team/plant/all access, direct-write denial and IDOR attempts.
- Test idempotent callable/event handling, rejected transitions and audit creation.
- Add UI tests when a supported React test setup exists; add browser/E2E coverage only after the app has stable authenticated routes.
- Phase 1 is done when direct URLs render a permission-denied state for unauthorized principals, Firestore rejects unauthorized/cross-tenant reads and all client writes, authorized users see every registered responsive route, and existing production/finance screens remain unchanged.
