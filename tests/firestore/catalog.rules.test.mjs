import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let testEnv;
const listing = {
  title: "Industrial storage crate",
  description: "Strong reusable crate for industrial dispatch.",
  category: "Storage & Crates",
  photos: [],
  moq: 10,
  unit: "pcs",
  gst: 18,
  leadTimeDays: 7,
  priceSlabs: [{ minQty: 10, maxQty: null, pricePerUnit: 320 }],
  published: false,
  titleLower: "industrial storage crate",
  keywords: ["industrial", "storage", "crate"],
};

describe.skipIf(!hasEmulator)("catalog Firestore rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({ projectId: "factory-catalog-rules", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  });

  afterAll(async () => { await testEnv?.cleanup(); });

  it("allows only an owner or plant manager to write their factory listing", async () => {
    const owner = testEnv.authenticatedContext("owner-a", { active: true, factory_id: "factory-a", role: "owner" }).firestore();
    const plantManager = testEnv.authenticatedContext("manager-a", { active: true, factory_id: "factory-a", role: "plant_manager" }).firestore();
    const operator = testEnv.authenticatedContext("operator-a", { active: true, factory_id: "factory-a", role: "operator" }).firestore();
    await assertSucceeds(setDoc(doc(owner, "factories/factory-a/catalogListings/listing-1"), listing));
    await assertSucceeds(setDoc(doc(plantManager, "factories/factory-a/catalogListings/listing-2"), listing));
    await assertFails(setDoc(doc(operator, "factories/factory-a/catalogListings/listing-3"), listing));
  });

  it("blocks cross-factory catalog access", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "factories/factory-a/catalogListings/listing-private"), listing));
    const otherFactoryOwner = testEnv.authenticatedContext("owner-b", { active: true, factory_id: "factory-b", role: "owner" }).firestore();
    await assertFails(getDoc(doc(otherFactoryOwner, "factories/factory-a/catalogListings/listing-private")));
    await assertFails(setDoc(doc(otherFactoryOwner, "factories/factory-a/catalogListings/listing-private"), listing));
  });

  it("exposes only active marketplace documents to the public", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "catalog/active-listing"), { active: true, title: "Safe listing" });
      await setDoc(doc(context.firestore(), "catalog/inactive-listing"), { active: false, title: "Unpublished listing" });
    });
    const publicDb = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(publicDb, "catalog/active-listing")));
    await assertFails(getDoc(doc(publicDb, "catalog/inactive-listing")));
    await assertFails(setDoc(doc(publicDb, "catalog/active-listing"), { active: true }));
  });
});
