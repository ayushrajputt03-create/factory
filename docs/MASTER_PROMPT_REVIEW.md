# Master prompt review and implementation

22 October 2026. User attachment reviewed in full.

Accepted: calm B2B design, ERP-owned listing, MOQ/slabs, guest browse, explicit fulfilment, accessible responsive controls and honest status feedback.

Corrections: preserve React/Vite and current dependencies; avoid adding Tailwind/Framer/Zustand/Redis without demonstrated need. Keep the existing architecture decision that PostgreSQL owns financial/order transactions. Put authentication and tenant authorization before backend writes, not the last phase. Use confirmed catalog data for ratings, MRP discounts, verified badges, certifications and delivery promises. No fabricated reviews or implied tax invoices. Public tracking requires server data and privacy controls; a local QR is not cross-device tracking. SSR and performance targets require measurement and deployment changes, not metadata alone.

First implementation: standalone marketplace design-token stylesheet with light/dark palette and reduced-motion support; calmer hero/cards/buttons; bulk-price helper, cart calculation and two regression tests. Public catalog retains price slabs for quantity-based repricing. Browser checkout remains a demo and is not a server-authoritative quote.

Pending: full PDP routing/variants/gallery, valid slab-gap handling and server repricing, reviews eligibility/moderation, RFQ integration, order/financial backend, delivery/returns, shared authenticated ERP context, responsive browser tests, measured web vitals and SSR strategy. This is not completion of every phase in the attachment.
