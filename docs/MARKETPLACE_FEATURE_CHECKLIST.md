# Marketplace responsive feature checklist

Light theme only. Preserve existing layout; use indigo as a restrained accent. Never fabricate ratings, discounts, verification, tax invoices or delivery promises.

| Feature | UI and backend dependency | Acceptance check | Status |
|---|---|---|---|
| Mobile bottom nav | Home/category/cart/account actions | All targets usable at 360px; cart badge reflects products | Implemented; browser QA pending |
| Search keyboard shortcut | `/` focuses search outside editable fields | Typing slash in form does not steal focus | Implemented; browser QA pending |
| Responsive product grid | 2 mobile, 3 tablet, 4 desktop | No horizontal page overflow | CSS exists; device QA pending |
| Guest cart/wishlist/recent | Browser persistence | Reload retains valid known products | Implemented; integration tests pending |
| Compare | Up to three products | Cannot select fourth | Implemented; browser QA pending |
| Bulk pricing | Quantity-matched price slabs | Boundary tests and server quote agree | Client helper tested; server checkout integration pending |
| Filter/sort sheets | Accessible focus-trapped sheet | Escape, focus restoration, touch targets | Pending |
| Full product detail/gallery | Real seller media and variant contracts | Variant updates one price block | Pending; quick-view exists |
| ERP listing publication | Authenticated factory + Firestore projection | Buyer sees only active public fields | Code connected; deployed end-to-end verification pending |
| Durable order routing | PostgreSQL authority and outbox | One checkout creates correct seller/factory allocations | Pending |
| Dispatch tracking | Server order lookup and courier events | Scan works on another device without exposing PII | Browser-only preview exists; real flow pending |
| Reviews | Delivered-order eligibility + moderation | One review per eligible order item | Pending |
| RFQ | Server quotes, expiry and acceptance | Accept once creates one order | Existing backend foundation; marketplace UI pending |
| Payments/refunds | Provider credentials, reconciliation, verified webhooks | Duplicate/late events preserve money state | Existing partial backend; launch blocked |

Later: voice search, video/360, GPS with consent/manual confirmation, advanced motion, multilingual content. Offline support means cached browsing/cart only, never guaranteed stock or checkout.
