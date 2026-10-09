import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let testEnv;
const order = { customerId: "buyer-1", factoryId: "factory-a", status: "placed", paymentStatus: "pending" };

describe.skipIf(!hasEmulator)("payment Firestore rules", () => {
  beforeAll(async () => { testEnv = await initializeTestEnvironment({ projectId: "factory-payment-rules", firestore: { rules: readFileSync("firestore.rules", "utf8") } }); });
  afterAll(async () => { await testEnv?.cleanup(); });

  it("allows only the buyer and correct factory users to read an order", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "orders/order-1"), order);
      await setDoc(doc(context.firestore(), "payments/payment-1"), { ...order, orderId: "order-1" });
    });
    const buyer = testEnv.authenticatedContext("buyer-1", { active: true }).firestore();
    const otherBuyer = testEnv.authenticatedContext("buyer-2", { active: true }).firestore();
    const factoryOwner = testEnv.authenticatedContext("owner-a", { active: true, factory_id: "factory-a", role: "owner" }).firestore();
    const otherFactory = testEnv.authenticatedContext("owner-b", { active: true, factory_id: "factory-b", role: "owner" }).firestore();
    await assertSucceeds(getDoc(doc(buyer, "orders/order-1")));
    await assertSucceeds(getDoc(doc(factoryOwner, "payments/payment-1")));
    await assertFails(getDoc(doc(otherBuyer, "orders/order-1")));
    await assertFails(getDoc(doc(otherFactory, "payments/payment-1")));
  });

  it("blocks clients from tampering with orders, payments and webhook logs", async () => {
    const buyer = testEnv.authenticatedContext("buyer-1", { active: true }).firestore();
    await assertFails(setDoc(doc(buyer, "orders/order-1"), order));
    await assertFails(setDoc(doc(buyer, "payments/payment-1"), { ...order, orderId: "order-1" }));
    await assertFails(setDoc(doc(buyer, "webhookEvents/fake-event"), { status: "captured" }));
  });

  it("blocks non-admin users from platform audit and payout records", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "auditLogs/log-1"), { action: "factory_approved" });
      await setDoc(doc(context.firestore(), "payouts/factory-a-2026-10"), { factoryId: "factory-a" });
    });
    const nonAdmin = testEnv.authenticatedContext("owner-a", { active: true, factory_id: "factory-a", role: "owner" }).firestore();
    const admin = testEnv.authenticatedContext("platform-admin", { admin: true }).firestore();
    await assertFails(getDoc(doc(nonAdmin, "auditLogs/log-1")));
    await assertFails(getDoc(doc(nonAdmin, "payouts/factory-a-2026-10")));
    await assertSucceeds(getDoc(doc(admin, "auditLogs/log-1")));
  });
});
