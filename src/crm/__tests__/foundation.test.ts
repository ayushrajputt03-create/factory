import { describe, expect, it } from "vitest";
import { canAccessCrm, defaultCrmScope, resolveCrmSection } from "../foundation";

const base = { authenticated: true, active: true, factoryId: "factory-a" };

describe("CRM authorization foundation", () => {
  it("denies anonymous, inactive and tenant-less principals", () => {
    expect(canAccessCrm({ ...base, authenticated: false, role: "owner" })).toBe(false);
    expect(canAccessCrm({ ...base, active: false, role: "owner" })).toBe(false);
    expect(canAccessCrm({ ...base, factoryId: undefined, role: "owner" })).toBe(false);
  });
  it("grants safe administrator defaults without elevating ordinary roles", () => {
    expect(canAccessCrm({ ...base, role: "owner" })).toBe(true);
    expect(canAccessCrm({ ...base, role: "plant_manager" })).toBe(true);
    expect(canAccessCrm({ ...base, role: "supervisor" })).toBe(false);
    expect(defaultCrmScope("owner")).toBe("plant");
  });
  it("supports explicit least-privilege permissions", () => {
    const principal = { ...base, role: "sales_executive", permissions: ["crm.leads.view"] };
    expect(canAccessCrm(principal, "crm.leads.view")).toBe(true);
    expect(canAccessCrm(principal, "crm.reports.view")).toBe(false);
  });
  it("normalizes unknown and nested CRM routes", () => {
    expect(resolveCrmSection("/crm/leads/LD-1")).toBe("leads");
    expect(resolveCrmSection("/crm/not-real")).toBe("overview");
  });
});
