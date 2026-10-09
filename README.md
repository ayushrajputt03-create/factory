# Factory OS

Mobile-first Phase 1 prototype for a small Indian manufacturing unit: production entry, flat BOMs, inventory movements, auto stock deduction, low-stock warnings, and owner reports.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## What is included

- React + Vite app with local seeded data
- Owner dashboard for production vs target, reject rate, and low-stock materials
- Shop-floor production entry that deducts material stock from the active BOM version
- Inventory stock IN/OUT form and movement history
- BOM/product workspace with active versions and material requirements
- Reports view with production summary and material consumption CSV export
- Firebase-ready app configuration via environment variables

## Selling Catalog

The Selling Catalog is available at `/catalog`. Private listing drafts live in `factories/{factoryId}/catalogListings`; `functions/src/index.ts` creates the buyer-safe top-level `catalog` copy. Configure `VITE_FACTORY_ID` only after an authenticated factory context exists.

- Upload up to six JPG, PNG or WebP photos, maximum 5 MB each; the browser compresses images before Firebase Storage upload.
- Use `docs/catalog-import-template.csv` for the CSV/Excel column layout. Imports have row-level validation before writing.
- Deploy the rules and catalog function with `firebase deploy --only firestore:rules,storage,functions`.
- Run the security suite with `firebase emulators:exec --only firestore "npm test -- --run"`.

## Razorpay test payments

Payments are implemented only in Firebase Functions. The client calls `createOrder` with catalog item IDs, quantities, address ID and either `full` or `advance`; it never sends a trusted price, tax or order total. A Razorpay webhook is the only path that marks a payment as paid.

1. Use a Razorpay **test-mode** account and set the three Firebase Function secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`.
2. Deploy with `firebase deploy --only functions,firestore:rules`.
3. Point Razorpay's test webhook to `razorpayWebhook`; configure the same webhook secret in Razorpay and Firebase.

Factory advance and cancellation settings live at `factories/{factoryId}.marketplaceSettings`: `advancePct` from 1–99 and `cancellationWindowMinutes` (default 60). Marketplace stock checking is enabled per internal product with `trackMarketplaceStock: true` and `availableForSale`.

## Next production steps

1. Connect Firebase Auth and persist app actions to Firestore.
2. Add Firestore security rules for factory membership and roles.
3. Replace seeded data with factory onboarding and invite flows.
4. Pilot with one real factory before expanding Phase 2 billing.
