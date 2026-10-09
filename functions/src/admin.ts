import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

const db = getFirestore();
const data = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 200) => typeof value === "string" ? value.trim().slice(0, max) : "";
const whole = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;

function requireAdmin(auth: { token: Record<string, unknown>; uid: string } | undefined) {
  if (!auth || auth.token.admin !== true) throw new HttpsError("permission-denied", "Administrator access is required.");
  return auth.uid;
}

async function audit(actorId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await db.collection("auditLogs").add({ actorId, action, targetType, targetId, details, createdAt: FieldValue.serverTimestamp() });
}

export const adminUpdateFactory = onCall(async (request) => {
  const actorId = requireAdmin(request.auth);
  const input = data(request.data); const factoryId = text(input.factoryId, 160); const status = text(input.status, 20); const reason = text(input.reason, 500);
  if (!factoryId || !["active", "suspended", "rejected"].includes(status) || (status !== "active" && !reason)) throw new HttpsError("invalid-argument", "Factory status and a reason are required.");
  const factoryRef = db.doc(`factories/${factoryId}`);
  await factoryRef.set({ status, suspended: status === "suspended", approvalReason: reason || null, approvedAt: status === "active" ? FieldValue.serverTimestamp() : null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (status === "suspended") {
    const listings = await factoryRef.collection("catalogListings").where("published", "==", true).get();
    await Promise.all(listings.docs.map((listing) => listing.ref.update({ published: false, updatedAt: FieldValue.serverTimestamp() })));
  }
  await audit(actorId, `factory_${status}`, "factory", factoryId, { reason });
  return { factoryId, status };
});

export const adminSetCommission = onCall(async (request) => {
  const actorId = requireAdmin(request.auth); const input = data(request.data); const commissionPct = whole(input.commissionPct, 0, 50); const factoryId = text(input.factoryId, 160);
  if (commissionPct === null) throw new HttpsError("invalid-argument", "Commission must be between 0 and 50.");
  const ref = factoryId ? db.doc(`factories/${factoryId}`) : db.doc("marketplaceSettings/global");
  await ref.set(factoryId ? { marketplaceSettings: { commissionPct }, updatedAt: FieldValue.serverTimestamp() } : { commissionPct, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(actorId, "commission_updated", factoryId ? "factory" : "global_settings", factoryId || "global", { commissionPct });
  return { commissionPct };
});

export const adminForceCancel = onCall(async (request) => {
  const actorId = requireAdmin(request.auth); const input = data(request.data); const orderId = text(input.orderId, 160); const reason = text(input.reason, 500);
  if (!orderId || !reason) throw new HttpsError("invalid-argument", "Order and cancellation reason are required.");
  const orderRef = db.doc(`orders/${orderId}`); const order = await orderRef.get();
  if (!order.exists) throw new HttpsError("not-found", "Order not found.");
  await orderRef.update({ status: "cancelled", adminCancellationReason: reason, updatedAt: FieldValue.serverTimestamp() });
  await orderRef.collection("events").add({ type: "admin_force_cancelled", actorId, reason, at: FieldValue.serverTimestamp() });
  await audit(actorId, "order_force_cancelled", "order", orderId, { reason });
  return { orderId, status: "cancelled" };
});

export const adminMarkPayoutPaid = onCall(async (request) => {
  const actorId = requireAdmin(request.auth); const input = data(request.data); const payoutId = text(input.payoutId, 160); const reference = text(input.reference, 160);
  if (!payoutId || !reference) throw new HttpsError("invalid-argument", "Payout and payment reference are required.");
  await db.doc(`payouts/${payoutId}`).update({ status: "paid", paymentReference: reference, paidAt: FieldValue.serverTimestamp(), paidBy: actorId });
  await audit(actorId, "payout_marked_paid", "payout", payoutId, { reference });
  return { payoutId, status: "paid" };
});

export const adminResolveDispute = onCall(async (request) => {
  const actorId = requireAdmin(request.auth); const input = data(request.data); const disputeId = text(input.disputeId, 160); const resolution = text(input.resolution, 20); const note = text(input.note, 1_000);
  if (!disputeId || !["refund", "rejected"].includes(resolution) || !note) throw new HttpsError("invalid-argument", "Resolution and note are required.");
  const disputeRef = db.doc(`disputes/${disputeId}`);
  await disputeRef.update({ status: "resolved", resolution, resolutionNote: note, resolvedBy: actorId, resolvedAt: FieldValue.serverTimestamp() });
  await disputeRef.collection("messages").add({ senderId: actorId, body: note, internal: true, createdAt: FieldValue.serverTimestamp() });
  await audit(actorId, "dispute_resolved", "dispute", disputeId, { resolution });
  return { disputeId, resolution };
});

export const onOrderDelivered = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data(); const after = event.data?.after.data();
  if (!after || before?.status === "delivered" || after.status !== "delivered") return;
  const factoryId = text(after.factoryId, 160); if (!factoryId) return;
  const factory = (await db.doc(`factories/${factoryId}`).get()).data() ?? {};
  const global = (await db.doc("marketplaceSettings/global").get()).data() ?? {};
  const commissionPct = whole(data(factory.marketplaceSettings).commissionPct, 0, 50) ?? whole(global.commissionPct, 0, 50) ?? 0;
  const grossAmountPaise = whole(after.totalAmountPaise, 0, Number.MAX_SAFE_INTEGER) ?? 0;
  const refundedPaise = whole(after.refundedAmountPaise, 0, grossAmountPaise) ?? 0;
  const commissionPaise = Math.round((grossAmountPaise - refundedPaise) * commissionPct / 100);
  const period = new Date().toISOString().slice(0, 7); const payoutRef = db.doc(`payouts/${factoryId}-${period}`); const lineRef = payoutRef.collection("lines").doc(event.params.orderId);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(lineRef)).exists) return;
    transaction.set(lineRef, { orderId: event.params.orderId, grossAmountPaise, commissionPaise, refundedPaise, settlementPaise: grossAmountPaise - commissionPaise - refundedPaise, deliveredAt: FieldValue.serverTimestamp() });
    transaction.set(payoutRef, { factoryId, period, status: "pending", grossAmountPaise: FieldValue.increment(grossAmountPaise), commissionPaise: FieldValue.increment(commissionPaise), refundedPaise: FieldValue.increment(refundedPaise), settlementPaise: FieldValue.increment(grossAmountPaise - commissionPaise - refundedPaise), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
});
