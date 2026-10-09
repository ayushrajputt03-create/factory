import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let testEnv;

describe.skipIf(!hasEmulator)("CRM Firestore rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({ projectId: "factory-crm-rules", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
    await testEnv.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "factories/factory-a/crm/leads/lead-1"), { factoryId: "factory-a", company: "Acme" }));
  });
  afterAll(async () => testEnv?.cleanup());

  it("allows safe administrator defaults and blocks other factories", async () => {
    const owner = testEnv.authenticatedContext("owner-a", { active: true, factory_id: "factory-a", role: "owner" }).firestore();
    const otherOwner = testEnv.authenticatedContext("owner-b", { active: true, factory_id: "factory-b", role: "owner" }).firestore();
    await assertSucceeds(getDoc(doc(owner, "factories/factory-a/crm/leads/lead-1")));
    await assertFails(getDoc(doc(otherOwner, "factories/factory-a/crm/leads/lead-1")));
  });

  it("denies ordinary users by default and honors explicit CRM access", async () => {
    const supervisor = testEnv.authenticatedContext("supervisor-a", { active: true, factory_id: "factory-a", role: "supervisor" }).firestore();
    const sales = testEnv.authenticatedContext("sales-a", { active: true, factory_id: "factory-a", role: "sales_executive", crm_access: true }).firestore();
    await assertFails(getDoc(doc(supervisor, "factories/factory-a/crm/leads/lead-1")));
    await assertSucceeds(getDoc(doc(sales, "factories/factory-a/crm/leads/lead-1")));
  });

  it("denies all client writes during the foundation phase", async () => {
    const owner = testEnv.authenticatedContext("owner-a", { active: true, factory_id: "factory-a", role: "owner" }).firestore();
    await assertFails(setDoc(doc(owner, "factories/factory-a/crm/leads/lead-2"), { factoryId: "factory-a" }));
  });
});
