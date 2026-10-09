import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();
const object = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;

export const createRfq = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to request a quote.");
  const input = object(request.data); const factoryIds = Array.isArray(input.factoryIds) ? [...new Set(input.factoryIds.filter((id): id is string => typeof id === "string" && id.length <= 160))].slice(0, 10) : [];
  const quantity = number(input.quantity, 1, 1_000_000); const city = text(input.deliveryCity, 100); const neededBy = text(input.neededBy, 20);
  if (!factoryIds.length || !quantity || !city || !neededBy || (!text(input.productId, 160) && !text(input.requirement, 2_000))) throw new HttpsError("invalid-argument", "Product or requirement, quantity, city, date and factory selection are required.");
  const rfqRef = db.collection("rfqs").doc();
  await rfqRef.set({ customerId: request.auth.uid, factoryIds, productId: text(input.productId, 160) || null, requirement: text(input.requirement, 2_000) || null, quantity, specification: text(input.specification, 2_000), files: Array.isArray(input.files) ? input.files.filter((file): file is string => typeof file === "string").slice(0, 6) : [], deliveryCity: city, neededBy, status: "open", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await Promise.all(factoryIds.map((factoryId) => db.doc(`factories/${factoryId}/notifications/rfq-${rfqRef.id}`).set({ type: "new_rfq", rfqId: rfqRef.id, createdAt: FieldValue.serverTimestamp(), read: false })));
  return { rfqId: rfqRef.id };
});

export const submitQuote = onCall(async (request) => {
  const auth = request.auth; const input = object(request.data); const rfqId = text(input.rfqId, 160); const factoryId = text(auth?.token.factory_id, 160);
  if (!auth?.uid || !factoryId || !["owner", "plant_manager"].includes(String(auth.token.role))) throw new HttpsError("permission-denied", "Factory quote permission is required.");
  const rfqRef = db.doc(`rfqs/${rfqId}`); const rfq = await rfqRef.get(); const data = rfq.data() ?? {};
  if (!rfq.exists || !Array.isArray(data.factoryIds) || !data.factoryIds.includes(factoryId) || data.status !== "open") throw new HttpsError("failed-precondition", "This RFQ is not open for your factory.");
  const unitPricePaise = number(input.unitPricePaise, 1, 1_000_000_000); const quantity = number(input.quantity, 1, 1_000_000); const leadTimeDays = number(input.leadTimeDays, 0, 365); const validUntil = text(input.validUntil, 20);
  if (!unitPricePaise || !quantity || leadTimeDays === null || !validUntil) throw new HttpsError("invalid-argument", "Complete the quote details.");
  const quoteRef = rfqRef.collection("quotes").doc();
  await quoteRef.set({ factoryId, unitPricePaise, quantity, leadTimeDays, validUntil, terms: text(input.terms, 2_000), status: "quoted", createdBy: auth.uid, createdAt: FieldValue.serverTimestamp() });
  await rfqRef.update({ status: "quoted", updatedAt: FieldValue.serverTimestamp() });
  await db.doc(`users/${data.customerId}/notifications/quote-${quoteRef.id}`).set({ type: "new_quote", rfqId, quoteId: quoteRef.id, createdAt: FieldValue.serverTimestamp(), read: false });
  return { quoteId: quoteRef.id };
});

export const acceptQuote = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to accept a quote.");
  const input = object(request.data); const rfqId = text(input.rfqId, 160); const quoteId = text(input.quoteId, 160); const rfqRef = db.doc(`rfqs/${rfqId}`); const quoteRef = rfqRef.collection("quotes").doc(quoteId);
  await db.runTransaction(async (transaction) => {
    const [rfq, quote] = await Promise.all([transaction.get(rfqRef), transaction.get(quoteRef)]); const rfqData = rfq.data() ?? {}; const quoteData = quote.data() ?? {};
    if (!rfq.exists || rfqData.customerId !== request.auth!.uid || rfqData.status === "accepted" || !quote.exists || quoteData.status !== "quoted" || new Date(quoteData.validUntil).getTime() < Date.now()) throw new HttpsError("failed-precondition", "This quote cannot be accepted.");
    const orderRef = db.collection("orders").doc(); const totalAmountPaise = quoteData.unitPricePaise * quoteData.quantity;
    transaction.create(orderRef, { factoryId: quoteData.factoryId, customerId: request.auth!.uid, source: "rfq", rfqId, quoteId, lines: [{ title: rfqData.productId || "Custom requirement", quantity: quoteData.quantity, unitPricePaise: quoteData.unitPricePaise }], totalAmountPaise, payableAmountPaise: totalAmountPaise, balanceDuePaise: 0, paymentStatus: "pending", status: "placed", checkoutRequired: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    transaction.update(rfqRef, { status: "accepted", acceptedQuoteId: quoteId, orderId: orderRef.id, updatedAt: FieldValue.serverTimestamp() }); transaction.update(quoteRef, { status: "accepted" }); transaction.create(orderRef.collection("events").doc(), { type: "created_from_rfq_quote", at: FieldValue.serverTimestamp() });
  });
  return { accepted: true };
});

export const expireQuotes = onSchedule("every 24 hours", async () => {
  const now = new Date().toISOString().slice(0, 10); const quotes = await db.collectionGroup("quotes").where("status", "==", "quoted").where("validUntil", "<", now).get();
  await Promise.all(quotes.docs.map(async (quote) => { await quote.ref.update({ status: "expired" }); const rfq = quote.ref.parent.parent; if (rfq) await rfq.update({ status: "expired", updatedAt: FieldValue.serverTimestamp() }); }));
});
