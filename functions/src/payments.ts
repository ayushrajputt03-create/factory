import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { calculateServerCart, type CartItem, type PublicCatalogItem, verifyRazorpaySignature } from "./paymentLogic.js";

if (!getApps().length) initializeApp();

const razorpayKeyId = defineSecret("RAZORPAY_KEY_ID");
const razorpayKeySecret = defineSecret("RAZORPAY_KEY_SECRET");
const razorpayWebhookSecret = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const db = getFirestore();

type PaymentOption = "full" | "advance";
type CheckoutInput = { cartItems?: unknown; addressId?: unknown; paymentOption?: unknown };
type OrderData = { factoryId: string; customerId: string; razorpayOrderId: string; paymentStatus: string; status: string; payableAmountPaise: number; totalAmountPaise: number; balanceDuePaise: number; advancePct: number; createdAt?: Timestamp };

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stringValue = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const amount = (value: unknown, maximum: number) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= maximum ? value : null;

function requireUser(uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return uid;
}

function isOwnerOrAdmin(auth: { token: Record<string, unknown>; uid: string } | undefined, factoryId: string) {
  if (!auth) return false;
  return auth.token.role === "admin" || (auth.token.active === true && auth.token.role === "owner" && auth.token.factory_id === factoryId);
}

async function razorpayRequest(path: string, method: "POST", keyId: string, keySecret: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new HttpsError("internal", "Payment provider could not complete the request.");
  return body;
}

function checkoutInput(data: unknown) {
  const input = data as CheckoutInput;
  const cartItems = Array.isArray(input?.cartItems) ? input.cartItems.map((item) => {
    const row = record(item);
    return { listingId: stringValue(row.listingId, 160), quantity: row.quantity } as CartItem;
  }) : [];
  const addressId = stringValue(input?.addressId, 160);
  const paymentOption: PaymentOption = input?.paymentOption === "advance" ? "advance" : "full";
  if (!addressId) throw new HttpsError("invalid-argument", "A delivery address is required.");
  return { cartItems, addressId, paymentOption };
}

async function loadCatalogItems(cartItems: CartItem[]) {
  const refs = cartItems.map((item) => db.doc(`catalog/${item.listingId}`));
  const docs = await db.getAll(...refs);
  return docs.flatMap((snapshot) => snapshot.exists ? [{ id: snapshot.id, ...snapshot.data() } as PublicCatalogItem] : []);
}

async function createOrderRecord(uid: string, input: ReturnType<typeof checkoutInput>, keyId: string, keySecret: string) {
  const catalogItems = await loadCatalogItems(input.cartItems);
  if (catalogItems.length !== input.cartItems.length) throw new HttpsError("failed-precondition", "One or more catalog products are unavailable.");
  const factorySnapshot = await db.doc(`factories/${catalogItems[0].factoryId}`).get();
  const factory = factorySnapshot.data() ?? {};
  const advancePct = input.paymentOption === "advance" ? amount(record(factory.marketplaceSettings).advancePct, 100) ?? 0 : 100;
  if (input.paymentOption === "advance" && (advancePct < 1 || advancePct >= 100)) throw new HttpsError("failed-precondition", "This factory does not offer advance payment for marketplace orders.");
  let calculation;
  try {
    calculation = calculateServerCart(input.cartItems, catalogItems, input.paymentOption, advancePct);
  } catch (error) {
    throw new HttpsError("invalid-argument", error instanceof Error ? error.message : "Invalid cart.");
  }
  const address = await db.doc(`users/${uid}/addresses/${input.addressId}`).get();
  if (!address.exists) throw new HttpsError("not-found", "Delivery address was not found.");
  const orderRef = db.collection("orders").doc();
  const razorpayOrder = await razorpayRequest("/orders", "POST", keyId, keySecret, {
    amount: calculation.payableAmountPaise,
    currency: "INR",
    receipt: orderRef.id,
    notes: { orderId: orderRef.id, factoryId: calculation.factoryId },
  });
  const razorpayOrderId = stringValue(razorpayOrder.id, 160);
  if (!razorpayOrderId) throw new HttpsError("internal", "Payment provider returned an invalid order.");
  const privateListings = await db.getAll(...calculation.lines.map((line) => db.doc(`factories/${calculation.factoryId}/catalogListings/${line.listingId}`)));
  const stockReservations = privateListings.flatMap((listing, index) => {
    const productId = stringValue(listing.data()?.internalProductId, 160);
    return productId ? [{ ref: db.doc(`factories/${calculation.factoryId}/products/${productId}`), quantity: calculation.lines[index].quantity }] : [];
  });
  await db.runTransaction(async (transaction) => {
    for (const reservation of stockReservations) {
      const product = await transaction.get(reservation.ref);
      const productData = product.data() ?? {};
      if (productData.trackMarketplaceStock === true) {
        const available = amount(productData.availableForSale, 1_000_000_000);
        if (available === null || available < reservation.quantity) throw new HttpsError("failed-precondition", "Insufficient stock for one or more products.");
        transaction.update(reservation.ref, { availableForSale: available - reservation.quantity, marketplaceReserved: FieldValue.increment(reservation.quantity), updatedAt: FieldValue.serverTimestamp() });
      }
    }
    transaction.create(orderRef, {
      factoryId: calculation.factoryId,
      customerId: uid,
      addressId: input.addressId,
      addressSnapshot: address.data(),
      lines: calculation.lines,
      totalAmountPaise: calculation.totalAmountPaise,
      payableAmountPaise: calculation.payableAmountPaise,
      advancePct: calculation.advancePct,
      balanceDuePaise: calculation.balanceDuePaise,
      currency: "INR",
      status: "placed",
      paymentStatus: "pending",
      razorpayOrderId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(orderRef.collection("events").doc(), { type: "order_placed", actorId: uid, at: FieldValue.serverTimestamp() });
  });
  return { orderId: orderRef.id, razorpayOrderId, keyId, amountPaise: calculation.payableAmountPaise, currency: "INR" };
}

export const createOrder = onCall({ secrets: [razorpayKeyId, razorpayKeySecret] }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const keyId = razorpayKeyId.value();
  const keySecret = razorpayKeySecret.value();
  if (!keyId || !keySecret) throw new HttpsError("failed-precondition", "Payments are not configured.");
  return createOrderRecord(uid, checkoutInput(request.data), keyId, keySecret);
});

function webhookPayment(payload: Record<string, unknown>) {
  const payment = record(record(payload.payload).payment).entity;
  const data = record(payment);
  return { id: stringValue(data.id, 160), orderId: stringValue(data.order_id, 160), amountPaise: amount(data.amount, 1_000_000_000_000_000), status: stringValue(data.status, 40) };
}

export const razorpayWebhook = onRequest({ secrets: [razorpayWebhookSecret] }, async (request, response) => {
  if (request.method !== "POST") { response.status(405).send("Method not allowed"); return; }
  if (!verifyRazorpaySignature(request.rawBody, request.get("X-Razorpay-Signature"), razorpayWebhookSecret.value())) { response.status(401).send("Invalid signature"); return; }
  const eventId = stringValue(request.get("X-Razorpay-Event-Id"), 160) || createHash("sha256").update(request.rawBody).digest("hex");
  const event = stringValue(request.body?.event, 100);
  const payment = webhookPayment(record(request.body));
  if (!payment.id || !payment.orderId) { response.status(400).send("Invalid payment payload"); return; }
  const orderQuery = await db.collection("orders").where("razorpayOrderId", "==", payment.orderId).limit(1).get();
  if (orderQuery.empty) { response.status(200).send("Order not found"); return; }
  const orderRef = orderQuery.docs[0].ref;
  await db.runTransaction(async (transaction) => {
    const eventRef = db.doc(`webhookEvents/${eventId}`);
    if ((await transaction.get(eventRef)).exists) return;
    const orderSnapshot = await transaction.get(orderRef);
    const order = orderSnapshot.data() as OrderData;
    const paymentRef = db.doc(`payments/${payment.id}`);
    const captured = event === "payment.captured" && payment.status === "captured";
    const nextPaymentStatus = captured ? (payment.amountPaise! >= order.payableAmountPaise ? "paid" : "partially_paid") : event === "payment.failed" ? "failed" : order.paymentStatus;
    transaction.create(eventRef, { event, paymentId: payment.id, orderId: orderRef.id, receivedAt: FieldValue.serverTimestamp() });
    transaction.set(paymentRef, { orderId: orderRef.id, factoryId: order.factoryId, customerId: order.customerId, razorpayPaymentId: payment.id, amountPaise: payment.amountPaise ?? 0, status: nextPaymentStatus, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (captured || event === "payment.failed") transaction.update(orderRef, { paymentStatus: nextPaymentStatus, status: nextPaymentStatus === "paid" ? "confirmed" : order.status, updatedAt: FieldValue.serverTimestamp() });
    transaction.create(orderRef.collection("events").doc(), { type: captured ? "payment_captured" : event, paymentId: payment.id, at: FieldValue.serverTimestamp() });
    transaction.set(db.doc(`factories/${order.factoryId}/notifications/${eventId}`), { type: captured ? "payment_received" : "payment_update", orderId: orderRef.id, paymentId: payment.id, createdAt: FieldValue.serverTimestamp(), read: false });
  });
  response.status(200).send("ok");
});

async function issueRefund(orderRef: FirebaseFirestore.DocumentReference, order: OrderData, paymentRef: FirebaseFirestore.DocumentReference, payment: FirebaseFirestore.DocumentData, refundAmountPaise: number, reason: string, actorId?: string) {
  const alreadyRefunded = typeof payment.amountRefundedPaise === "number" ? payment.amountRefundedPaise : 0;
  if (refundAmountPaise > payment.amountPaise - alreadyRefunded) throw new HttpsError("failed-precondition", "Refund exceeds the captured amount.");
  const result = await razorpayRequest(`/payments/${payment.razorpayPaymentId}/refund`, "POST", razorpayKeyId.value(), razorpayKeySecret.value(), { amount: refundAmountPaise, notes: { orderId: orderRef.id, reason } });
  const refundId = stringValue(result.id, 160);
  if (!refundId) throw new HttpsError("internal", "Payment provider returned an invalid refund.");
  await db.runTransaction(async (transaction) => {
    transaction.set(db.doc(`refunds/${refundId}`), { orderId: orderRef.id, paymentId: paymentRef.id, factoryId: order.factoryId, amountPaise: refundAmountPaise, reason, status: "pending", createdAt: FieldValue.serverTimestamp() });
    transaction.update(paymentRef, { amountRefundedPaise: alreadyRefunded + refundAmountPaise, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(orderRef, { paymentStatus: alreadyRefunded + refundAmountPaise >= payment.amountPaise ? "refunded" : "partially_refunded", updatedAt: FieldValue.serverTimestamp() });
    transaction.create(orderRef.collection("events").doc(), { type: "refund_requested", refundId, amountPaise: refundAmountPaise, actorId, at: FieldValue.serverTimestamp() });
  });
  return refundId;
}

export const refundOrder = onCall({ secrets: [razorpayKeyId, razorpayKeySecret] }, async (request) => {
  const input = record(request.data);
  const orderId = stringValue(input.orderId, 160);
  const refundAmountPaise = amount(input.amountPaise, 1_000_000_000_000_000);
  const reason = stringValue(input.reason, 160) || "requested_by_factory";
  if (!orderId || !refundAmountPaise) throw new HttpsError("invalid-argument", "Order and refund amount are required.");
  const orderRef = db.doc(`orders/${orderId}`);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnapshot.data() as OrderData;
  if (!isOwnerOrAdmin(request.auth, order.factoryId)) throw new HttpsError("permission-denied", "Only a factory owner or administrator can refund an order.");
  const paymentQuery = await db.collection("payments").where("orderId", "==", orderId).where("status", "in", ["paid", "partially_paid"]).limit(1).get();
  if (paymentQuery.empty) throw new HttpsError("failed-precondition", "No captured payment is available for refund.");
  const paymentRef = paymentQuery.docs[0].ref;
  const payment = paymentQuery.docs[0].data();
  const refundId = await issueRefund(orderRef, order, paymentRef, payment, refundAmountPaise, reason, request.auth?.uid);
  return { refundId, status: "pending" };
});

export const cancelOrder = onCall({ secrets: [razorpayKeyId, razorpayKeySecret] }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const orderId = stringValue(record(request.data).orderId, 160);
  const orderRef = db.doc(`orders/${orderId}`);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists) throw new HttpsError("not-found", "Order not found.");
  const order = orderSnapshot.data() as OrderData;
  if (order.customerId !== uid && !isOwnerOrAdmin(request.auth, order.factoryId)) throw new HttpsError("permission-denied", "You cannot cancel this order.");
  const factory = (await db.doc(`factories/${order.factoryId}`).get()).data() ?? {};
  const cancellationWindowMinutes = amount(record(factory.marketplaceSettings).cancellationWindowMinutes, 10_080) ?? 60;
  const createdAt = order.createdAt?.toMillis() ?? 0;
  if (!createdAt || Date.now() > createdAt + cancellationWindowMinutes * 60_000 || !["placed", "confirmed"].includes(order.status)) throw new HttpsError("failed-precondition", "This order can no longer be cancelled.");
  await orderRef.update({ status: "cancelled", cancellationRequestedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await orderRef.collection("events").add({ type: "order_cancelled", actorId: uid, at: FieldValue.serverTimestamp() });
  if (["paid", "partially_paid"].includes(order.paymentStatus)) {
    const paymentQuery = await db.collection("payments").where("orderId", "==", orderId).where("status", "in", ["paid", "partially_paid"]).limit(1).get();
    if (!paymentQuery.empty) {
      const payment = paymentQuery.docs[0].data();
      const refundable = payment.amountPaise - (payment.amountRefundedPaise ?? 0);
      if (refundable > 0) await issueRefund(orderRef, order, paymentQuery.docs[0].ref, payment, refundable, "order_cancelled", uid);
    }
  }
  return { orderId, status: "cancelled" };
});
