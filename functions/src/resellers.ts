import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
const db = getFirestore();
const value = (input: unknown, max = 160) => typeof input === "string" ? input.trim().slice(0, max) : "";
const pct = (input: unknown) => typeof input === "number" && Number.isFinite(input) && input >= 0 && input <= 50 ? input : null;

export const inviteReseller = onCall(async (request) => {
  const factoryId = value(request.data?.factoryId); if (!request.auth || request.auth.token.factory_id !== factoryId || request.auth.token.role !== "owner") throw new HttpsError("permission-denied", "Factory owner access is required.");
  const uid = value(request.data?.uid); const parentId = value(request.data?.parentId) || null; const marginPct = pct(request.data?.marginPct); if (!uid || marginPct === null) throw new HttpsError("invalid-argument", "Reseller user and margin are required.");
  if (parentId) { const parent = await db.doc(`resellers/${parentId}`).get(); const parentData = parent.data(); if (!parent.exists || parentData?.factoryId !== factoryId || parentData?.parentId !== null) throw new HttpsError("failed-precondition", "Only a distributor can be a reseller parent."); }
  const ref = db.collection("resellers").doc(); await ref.set({ factoryId, uid, parentId, marginPct, territory: value(request.data?.territory, 200), status: "active", createdAt: FieldValue.serverTimestamp() }); return { resellerId: ref.id };
});

export const onResellerOrderDelivered = onDocumentUpdated("orders/{orderId}", async (event) => {
  const before = event.data?.before.data(); const order = event.data?.after.data(); if (!order || before?.status === "delivered" || order.status !== "delivered" || !order.resellerId) return;
  const reseller = await db.doc(`resellers/${order.resellerId}`).get(); if (!reseller.exists) return; const first = reseller.data()!; const chain = [reseller, first.parentId ? await db.doc(`resellers/${first.parentId}`).get() : null].filter(Boolean);
  await Promise.all(chain.map(async (node) => { const data = node!.data()!; const amountPaise = Math.round((order.totalAmountPaise || 0) * data.marginPct / 100); await db.doc(`resellerEarnings/${event.params.orderId}_${node!.id}`).set({ orderId: event.params.orderId, resellerId: node!.id, factoryId: data.factoryId, amountPaise, status: "pending", createdAt: FieldValue.serverTimestamp() }); }));
});
