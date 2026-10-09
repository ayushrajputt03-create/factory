import { createHmac, timingSafeEqual } from "node:crypto";

export type CatalogPriceSlab = { minQty: number; maxQty: number | null; pricePerUnit: number };
export type PublicCatalogItem = { id: string; active: boolean; factoryId: string; title: string; moq: number; gst: number; priceSlabs: CatalogPriceSlab[] };
export type CartItem = { listingId: string; quantity: number };
export type CalculatedLine = { listingId: string; title: string; quantity: number; unitPricePaise: number; gstPct: number; taxableAmountPaise: number; gstAmountPaise: number; totalAmountPaise: number };

const integer = (value: unknown, minimum: number, maximum: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;

export function selectPriceSlab(slabs: CatalogPriceSlab[], quantity: number): CatalogPriceSlab | null {
  const matching = slabs.filter((slab) => integer(slab.minQty, 1, 1_000_000) && (slab.maxQty === null || integer(slab.maxQty, slab.minQty, 1_000_000)) && typeof slab.pricePerUnit === "number" && Number.isFinite(slab.pricePerUnit) && slab.pricePerUnit > 0 && quantity >= slab.minQty && (slab.maxQty === null || quantity <= slab.maxQty));
  return matching.length === 1 ? matching[0] : null;
}

export function calculateServerCart(cartItems: CartItem[], catalogItems: PublicCatalogItem[], paymentOption: "full" | "advance", advancePct: number) {
  if (!Array.isArray(cartItems) || cartItems.length === 0 || cartItems.length > 20) throw new Error("Cart must contain between 1 and 20 items.");
  if (!integer(advancePct, 1, 100)) throw new Error("Advance percentage is invalid.");
  const seen = new Set<string>();
  const lines = cartItems.map((item) => {
    if (!item || typeof item.listingId !== "string" || !integer(item.quantity, 1, 1_000_000) || seen.has(item.listingId)) throw new Error("Cart contains an invalid or duplicate item.");
    seen.add(item.listingId);
    const catalog = catalogItems.find((candidate) => candidate.id === item.listingId && candidate.active);
    if (!catalog || !integer(catalog.moq, 1, 1_000_000) || item.quantity < catalog.moq) throw new Error("A product is unavailable or does not meet its MOQ.");
    const slab = selectPriceSlab(catalog.priceSlabs, item.quantity);
    if (!slab || typeof catalog.gst !== "number" || catalog.gst < 0 || catalog.gst > 28) throw new Error("A product price is not available.");
    const unitPricePaise = Math.round(slab.pricePerUnit * 100);
    const taxableAmountPaise = unitPricePaise * item.quantity;
    const gstAmountPaise = Math.round(taxableAmountPaise * catalog.gst / 100);
    return { listingId: catalog.id, title: catalog.title, quantity: item.quantity, unitPricePaise, gstPct: catalog.gst, taxableAmountPaise, gstAmountPaise, totalAmountPaise: taxableAmountPaise + gstAmountPaise } satisfies CalculatedLine;
  });
  const factoryIds = new Set(catalogItems.filter((item) => lines.some((line) => line.listingId === item.id)).map((item) => item.factoryId));
  if (factoryIds.size !== 1) throw new Error("Checkout supports products from one factory at a time.");
  const totalAmountPaise = lines.reduce((sum, line) => sum + line.totalAmountPaise, 0);
  const payableAmountPaise = paymentOption === "advance" ? Math.round(totalAmountPaise * advancePct / 100) : totalAmountPaise;
  return { lines, factoryId: [...factoryIds][0], totalAmountPaise, payableAmountPaise, advancePct: paymentOption === "advance" ? advancePct : 100, balanceDuePaise: totalAmountPaise - payableAmountPaise };
}

export function verifyRazorpaySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signature, "utf8");
  const calculated = Buffer.from(expected, "utf8");
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export function shouldProcessWebhook(existingEvent: boolean): boolean {
  return !existingEvent;
}
