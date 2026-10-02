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
- Supabase-ready schema in `supabase/schema.sql`

## Next production steps

1. Connect Supabase Auth and persist the app actions to Postgres.
2. Add row-level security policies for owner vs supervisor access.
3. Replace seeded data with factory onboarding and invite flows.
4. Pilot with one real factory before expanding Phase 2 billing.
