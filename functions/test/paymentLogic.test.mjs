import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { calculateServerCart, shouldProcessWebhook, verifyRazorpaySignature } from "../lib/paymentLogic.js";

const listing = { id: "listing-1", active: true, factoryId: "factory-1", title: "Industrial crate", moq: 10, gst: 18, priceSlabs: [{ minQty: 10, maxQty: 99, pricePerUnit: 320 }, { minQty: 100, maxQty: null, pricePerUnit: 280 }] };

test("recalculates catalog price and ignores client-supplied amounts", () => {
  const cart = calculateServerCart([{ listingId: "listing-1", quantity: 100, price: 1 }], [listing], "full", 100);
  assert.equal(cart.lines[0].unitPricePaise, 28000);
  assert.equal(cart.totalAmountPaise, 3304000);
});

test("rejects MOQ and invalid slab quantities", () => {
  assert.throws(() => calculateServerCart([{ listingId: "listing-1", quantity: 1 }], [listing], "full", 100));
});

test("verifies a fake Razorpay webhook signature", () => {
  const rawBody = Buffer.from('{"event":"payment.captured"}');
  const secret = "test-webhook-secret";
  const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(verifyRazorpaySignature(rawBody, signature, secret), true);
  assert.equal(verifyRazorpaySignature(rawBody, "tampered", secret), false);
});

test("handles duplicate payment events once", () => {
  assert.equal(shouldProcessWebhook(false), true);
  assert.equal(shouldProcessWebhook(true), false);
});
