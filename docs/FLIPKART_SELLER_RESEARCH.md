# Flipkart seller research — 21 October 2026

Scope: REA controlled public Seller Hub inspection plus official seller API/help documentation. Authenticated dashboard was not accessed; exact private screen layouts are unverified. No account was created and no product/order was submitted.

REA evidence: ev_7700cc52caf749726c1f771d75136357398dfddc2375f671862e2fbeb8d38096. Observed public Login/Start Selling entry points, onboarding journey, listing/payment/selection feature previews and seller-support links. This is public-page evidence only.

## Module map

Official public resources cover onboarding, listings, inventory, order fulfilment, returns, payments, promotions, seller performance, support and account administration. These are capability groupings, not an assertion of exact current sidebar labels.

## Critical order distinction

The official order API states standard stock-backed orders do not have a seller acceptance step: available inventory commits the seller to fulfilment. Shipments drive operational actions. Factory OS should use fulfilment actions for stocked products and reserve approve/reject for RFQs or made-to-order workflows. See https://seller.flipkart.com/api-docs/order-api-docs/OMAPIOverview.html .

## Listing model and workflow

Product identity and seller offer must be distinct. The seller SKU maps to a listing; commercial fields and stock can change without redefining the shared product. Official listing APIs cover create/update, stock per location, prices, tax classification, fulfilment timing and offer activation. See https://seller.flipkart.com/api-docs/listing-api-docs/LMAPIOverview.html .

Help index confirms guides for category/brand approval, single and bulk listing, images, packaging, validation, QC feedback and correcting failures. It also distinguishes adding an offer to an existing catalog product from creating a new catalog entry. See https://seller.flipkart.com/sitemap .

## Proposed Factory OS UI, not copied private UI

ERP sidebar: Commerce Overview / Product Listings / Marketplace Inventory / Orders & Shipments / Returns / Payments & Reconciliation / Resellers / Performance / Support / Settings.

Listing wizard: choose ERP product or new catalog identity → category/brand eligibility → content and attributes → images → pricing/tax/MOQ → location stock/package/SLA → review → submit for validation → status/result.

Status tabs: Draft / Validation issues / In review / Live / Inactive / Out of stock. Row shows image, title, SKU, product and listing IDs, stock, selling price, location, visibility, last sync/error and buyer link. Publish must not claim live until the public projection is confirmed.

Order workspace: fulfilment-stage tabs, deadline indicators, line items, buyer delivery data scoped to fulfilment need, invoice/label download, packing, ready-to-dispatch, tracking and cancellation reason. All state changes require server authorization and audit records.

Reseller is a separate business model: do not assume a Flipkart seller is a commission-only referral agent. Factory OS needs its own reseller agreement, attribution, margin rules and delivered-order ledger; do not invent a multi-level payout scheme from Seller Hub observations.

## Limits and next evidence

Private dashboard usability, account-specific category requirements, seller fees, QC timings and settlement schedule cannot be generalized from this capture. Inspect an authorized seller session or user-supplied screenshots before claiming exact layout parity. Existing Factory OS preview is not implementation of this entire workflow.
