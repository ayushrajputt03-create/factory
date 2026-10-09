import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";

const db = getFirestore();
const appSecret = defineSecret("WHATSAPP_APP_SECRET"); const verifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN"); const encryptionKey = defineSecret("WHATSAPP_TOKEN_ENCRYPTION_KEY");
const text = (value: unknown, max = 2_000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const admin = (auth: { token: Record<string, unknown> } | undefined, factoryId: string) => auth?.token.active === true && auth.token.factory_id === factoryId && ["owner", "plant_manager"].includes(String(auth.token.role));
const key = () => Buffer.from(encryptionKey.value(), "base64");
function encrypt(token: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); return { ciphertext: Buffer.concat([cipher.update(token, "utf8"), cipher.final()]).toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") }; }

export const connectWhatsApp = onCall({ secrets: [encryptionKey] }, async (request) => { const factoryId = text(request.data?.factoryId, 160); const phoneNumberId = text(request.data?.phoneNumberId, 160); const wabaId = text(request.data?.wabaId, 160); const token = text(request.data?.token, 2_000); if (!factoryId || !phoneNumberId || !wabaId || !token || !admin(request.auth, factoryId)) throw new HttpsError("permission-denied", "Factory owner access is required."); await db.doc(`whatsappAccounts/${factoryId}`).set({ factoryId, phoneNumberId, wabaId, token: encrypt(token), active: true, updatedAt: FieldValue.serverTimestamp() }); return { connected: true }; });
export const disconnectWhatsApp = onCall(async (request) => { const factoryId = text(request.data?.factoryId, 160); if (!factoryId || !admin(request.auth, factoryId)) throw new HttpsError("permission-denied", "Factory owner access is required."); await db.doc(`whatsappAccounts/${factoryId}`).update({ active: false, updatedAt: FieldValue.serverTimestamp() }); return { disconnected: true }; });

export const whatsappWebhook = onRequest({ secrets: [appSecret, verifyToken] }, async (request, response) => {
  if (request.method === "GET") { if (request.query["hub.verify_token"] === verifyToken.value()) response.status(200).send(request.query["hub.challenge"]); else response.sendStatus(403); return; }
  const signature = request.get("X-Hub-Signature-256") || ""; const expected = `sha256=${createHmac("sha256", appSecret.value()).update(request.rawBody).digest("hex")}`;
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) { response.sendStatus(401); return; }
  const change = request.body?.entry?.[0]?.changes?.[0]?.value; const phoneNumberId = text(change?.metadata?.phone_number_id, 160); const message = change?.messages?.[0]; if (!phoneNumberId || !message?.id) { response.sendStatus(200); return; }
  const account = await db.collection("whatsappAccounts").where("phoneNumberId", "==", phoneNumberId).where("active", "==", true).limit(1).get(); if (account.empty) { response.sendStatus(200); return; }
  const factoryId = account.docs[0].id; const phone = text(message.from, 32); const body = text(message.text?.body || message.caption || "", 4_000); const conversationId = `${factoryId}_${phone}`; const eventRef = db.doc(`whatsappEvents/${message.id}`); const conversationRef = db.doc(`conversations/${conversationId}`);
  await db.runTransaction(async (transaction) => { if ((await transaction.get(eventRef)).exists) return; const optedOut = /^(stop|unsubscribe)$/i.test(body); transaction.create(eventRef, { factoryId, waMessageId: message.id, createdAt: FieldValue.serverTimestamp() }); transaction.set(conversationRef, { factoryId, customerPhone: phone, unreadCount: FieldValue.increment(1), lastMessageAt: FieldValue.serverTimestamp(), status: "open", marketingOptOut: optedOut ? true : FieldValue.delete() }, { merge: true }); transaction.create(conversationRef.collection("messages").doc(), { direction: "inbound", type: message.type || "text", text: body, waMessageId: message.id, status: "received", createdAt: FieldValue.serverTimestamp() }); }); response.sendStatus(200);
});
