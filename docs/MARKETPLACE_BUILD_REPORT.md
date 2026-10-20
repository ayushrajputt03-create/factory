# Marketplace build report

## ERP-owned public catalog

Buyer marketplace now subscribes to active public catalog projections generated from Factory OS ERP catalogListings. Configured Firebase uses live records with loading/empty/error states and never falls back to sample products on failure. Unconfigured environments retain clearly identified sample preview. Uses listing photos and MOQ-matching slab price. Product creation remains in ERP. Existing public projection Function must be deployed; factory identity configuration, slab-aware cart repricing and durable checkout remain pending. Initial production build passed.

## Catalog route correction

Fixed `/catalog` accidentally matching the `/ca` prefix and opening CA Portal. CA path matching now accepts only `/ca` and `/ca/…`. Existing identity-based CA/HR restrictions remain. Production build passed. Authenticated users with CA or missing role claims may still be routed to their restricted portal by design.

## Operator seller-review screen

Connected admin Factory approvals to a live submitted-application Firestore query and reviewSellerApplication callable. Includes loading/empty/error states, mandatory review reason and approve/request-changes/reject actions. UI explicitly distinguishes marketplace approval from GST/bank/KYC certification. Operator authentication still uses existing admin claim. Backend deployment, approved admin account and Firebase configuration remain necessary. Full commerce delivery remains incomplete.

## Seller review and provisioning backend

Added admin-only reviewSellerApplication with mandatory reason and applicant eligibility checks. Approval atomically creates factory, owner membership, application decision and audit event; merged custom claims provision owner access afterward. Repeating approval repairs an interrupted claim write. Approved sellers must use suspension flow rather than application rejection. Functions build and existing 21 tests passed; no new emulator/integration coverage yet. Admin review UI, authenticated factory routing, PostgreSQL service, external configuration and production deployment remain pending. This is partial implementation, not full delivery.

## 21 October 2026 — Seller application wiring

Replaced the browser-local seller application form with ConnectedSeller: Firebase identity listener, own application status subscription and verified-email callable submission. Captures form values before asynchronous token refresh. Submitted applications are locked from duplicate submission by backend transaction and UI status. Production build passed. Firebase deployment/configuration and operator approval/provisioning are still required; the public storefront remains sample catalog and browser-local demo orders.

## Recently viewed and reorder

Added six-item browser-local recently-viewed history with clear-history control. Added reorder actions using current known catalog offers and prices, validated quantities and a 100,000-unit cart cap. Reorder opens the cart for review; no payment or stock promise is made. Production build passed. Browser interaction tests remain pending.

## Connected identity foundation

Added Firebase buyer email/password registration, verification email, sign-in and sign-out panel. When Firebase is absent the UI reports account service unavailable. Added server-owned submitSellerApplication callable requiring a verified email, bounded fields, transactionally enforced application state and atomic audit entry. Rules allow applicant/admin reads and deny direct writes. The seller UI is still the existing local demo form; callable wiring, operator approval/provisioning, emulator authorization tests and deployed Firebase configuration remain pending. No claim of complete marketplace readiness is made.

## Demo catalog imagery

Added a local storage-crate SVG illustration and category-level remote demo photography for packaging/components in cards and quick view. Remote image failures fall back to the local illustration. Images are representative category visuals, not photographs of the listed SKU. Production build passed. Remote photos require network connectivity; banner artwork remains illustrative.

## Advanced shopping tools

Implemented browser-persisted cart with known-offer/quantity validation, persisted wishlist with known-ID validation, saved-only browsing, maximum unit-price filter, reset filters and a three-product comparison table with seller, city, MOQ and minimum subtotal. Storage failures produce a visible status message. Production build passed. These are browser-local demo features; authenticated seller onboarding, durable cross-device orders, payment and fulfilment integrations remain pending. Browser interaction testing has not been completed for this slice.

## Screenshot-led storefront refinement

Applied the user-provided Flipkart screenshots as visual references: white sticky search header, yellow Factory Market brand tile, horizontal department navigation, rounded promotional panels, denser product grid and a separate cart price summary. Cart summary uses actual demo subtotal and explicitly leaves tax/shipping uncalculated; no fabricated ratings, discounts or delivery promises added. Production build passed. Product photography and browser interaction verification remain pending.

## Ecommerce storefront upgrade

Applied REA reverse-engineer-anything skill. Reused prior Flipkart homepage observation (ev_0670e903a97dad0c372ff3b4bbe2adce0137e823eeda6dc8aa788bfec0106f3c). Amazon India controlled capture (ev_093c0570431f4ce6dbb369dbb76c2677d5c5c3f7008c73b5ff5e30147f4edff3) returned only an empty accessibility document, so no Amazon behavior was established. New layout is an original design informed by general ecommerce conventions, not a reconstruction of either private backend.

Added search-led navy header, department navigation, campaign hero, category collections, shopping-benefit strip, sortable product grid, session wishlist toggles and quick-view product dialog. Existing demo cart, order history and seller application remain available. Sample illustrations are typographic symbols; production product photography and authenticated commerce remain pending. Production build passed; browser interaction checks remain pending.

## Buyer marketplace demo

Added `/marketplace`: responsive product discovery, category/search filters, MOQ-aware cart, buyer/address demo checkout, browser-local order history and demo seller application form. Added `/marketplace/inbox` with factory-filtered fulfilment previews. Both surfaces explicitly label sample data and browser-local persistence. No payment is collected, no user account is created, and factory filtering is not tenant authorization. Added `src/Marketplace.tsx`, `src/marketplace.css` and surgical App routing. Production build passed. Browser interaction verification remains pending. This is an interactive prototype; authenticated backend onboarding, public catalog integration and durable orders remain pending.

## 20 October 2026 — Foundation slice

Implemented: explicit marketplace feature policy, regression tests, HTTP liveness endpoint and GitHub Actions verification workflow. Real checkout and settlements are hard-disabled in the new policy. This policy does not yet guard legacy payment Functions; it must be wired into new marketplace routes before those routes launch.

The health endpoint reports liveness and explicitly reports commerce as unavailable. It does not test database readiness. CI runs root tests/build and Functions tests; dependency audit output is retained as an artifact and currently does not block CI. Emulator integration and mandatory audit enforcement remain pending.

Existing CA/HR, payment and favicon changes were preserved. No deployment or commit was performed.

## Remaining delivery

Authenticated tenant context; seller registration and approval; buyer storefront and search; listing moderation; quote cart; PostgreSQL order/ledger/outbox authority; sandbox checkout; factory fulfilment projections; shipment tracking; returns; settlements and operator controls.

Real-money launch remains dependent on approved funds-flow/invoicing decisions and verified commerce backend. Existing payment changes remain subject to the unresolved review findings recorded in the prior audit.

Verification: root tests 31 passed, 13 emulator-dependent tests skipped; production build passed with the existing 1.51 MB JavaScript chunk warning; Functions TypeScript build and 21 tests passed, none skipped. These checks validate the foundation only; the full marketplace is not yet implemented.
