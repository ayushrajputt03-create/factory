# Shipment tracking update

- Added manual shipment checkpoints to `/dispatch-preview`: Dispatched → In transit → Out for delivery → Delivered.
- Each checkpoint retains location, timestamp and optional note; multiple hubs can be recorded during transit.
- Buyer QR tracking displays the last reported location and journey history, without recipient address or phone.
- Tracking refreshes when another tab changes local storage or the window regains focus; manual refresh is available.
- Sequential transitions are checked against the latest stored order. Delivered orders cannot receive further checkpoints.
- Demo only: no live GPS, carrier API, SMS/WhatsApp notifications or cross-device database tracking. Existing packing slip remains non-tax documentation.
