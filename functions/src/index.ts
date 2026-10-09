import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
export { cancelOrder, createOrder, razorpayWebhook, refundOrder } from "./payments.js";
export { adminForceCancel, adminMarkPayoutPaid, adminResolveDispute, adminSetCommission, adminUpdateFactory, onOrderDelivered } from "./admin.js";
export { acceptQuote, createRfq, expireQuotes, submitQuote } from "./rfq.js";
export { connectWhatsApp, disconnectWhatsApp, whatsappWebhook } from "./whatsapp.js";
export { inviteReseller, onResellerOrderDelivered } from "./resellers.js";

type Listing = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  photos?: unknown;
  moq?: unknown;
  unit?: unknown;
  gst?: unknown;
  leadTimeDays?: unknown;
  priceSlabs?: unknown;
  published?: unknown;
  titleLower?: unknown;
  keywords?: unknown;
};

const asString = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const asNumber = (value: unknown, minimum: number, maximum: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;
const asStringList = (value: unknown, maximumItems: number, itemLength: number) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, itemLength)).filter(Boolean).slice(0, maximumItems) : [];

function publicPriceSlabs(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const slabs = value.map((slab) => {
    if (!slab || typeof slab !== "object") return null;
    const data = slab as Record<string, unknown>;
    if (typeof data.minQty !== "number" || !Number.isFinite(data.minQty) || data.minQty < 1) return null;
    if (data.maxQty !== null && (typeof data.maxQty !== "number" || !Number.isFinite(data.maxQty) || data.maxQty < data.minQty)) return null;
    if (typeof data.pricePerUnit !== "number" || !Number.isFinite(data.pricePerUnit) || data.pricePerUnit <= 0) return null;
    return { minQty: data.minQty, maxQty: data.maxQty, pricePerUnit: data.pricePerUnit };
  });
  if (slabs.some((slab) => slab === null)) return null;
  const validSlabs = slabs.filter((slab): slab is { minQty: number; maxQty: number | null; pricePerUnit: number } => slab !== null);
  const sorted = [...validSlabs].sort((left, right) => left.minQty - right.minQty);
  if (sorted.some((slab, index) => {
    const previous = sorted[index - 1];
    return index > 0 && previous !== undefined && (previous.maxQty === null || slab.minQty <= previous.maxQty);
  })) return null;
  return sorted;
}

export const onProductWrite = onDocumentWritten("factories/{factoryId}/catalogListings/{listingId}", async (event) => {
  const { factoryId, listingId } = event.params;
  const catalogRef = getFirestore().doc(`catalog/${listingId}`);
  const listing = event.data?.after.exists ? event.data.after.data() as Listing : undefined;
  const factory = await getFirestore().doc(`factories/${factoryId}`).get();
  const factoryData = factory.exists ? factory.data() ?? {} : {};
  const priceSlabs = listing ? publicPriceSlabs(listing.priceSlabs) : null;
  const active = Boolean(listing?.published) && factoryData.suspended !== true && priceSlabs !== null;

  if (!listing) {
    await catalogRef.set({ active: false, factoryId, updatedAt: new Date() }, { merge: true });
    return;
  }

  const title = asString(listing.title, 120);
  const category = asString(listing.category, 80);
  const description = asString(listing.description, 2000);
  const normalizedTitle = asString(listing.titleLower, 120).toLowerCase() || title.toLowerCase();
  await catalogRef.set({
    factoryId,
    factoryName: asString(factoryData.publicName ?? factoryData.name, 120),
    title,
    description,
    category,
    photos: asStringList(listing.photos, 6, 2_000),
    moq: asNumber(listing.moq, 1, 1_000_000_000),
    unit: asString(listing.unit, 24),
    gst: asNumber(listing.gst, 0, 28),
    leadTimeDays: asNumber(listing.leadTimeDays, 0, 365),
    priceSlabs: priceSlabs ?? [],
    active,
    titleLower: normalizedTitle,
    keywords: asStringList(listing.keywords, 30, 50),
    updatedAt: new Date(),
  }, { merge: true });
});
