import { describe, expect, it } from "vitest";
import { marketplaceFeatures } from "../marketplacePolicy";

describe("marketplace launch policy", () => {
  it("cannot enable money movement through environment variables", () => {
    const flags = marketplaceFeatures({ MODE: "production", VITE_REAL_CHECKOUT: "true", VITE_SETTLEMENTS: "true", VITE_MARKETPLACE_DEMO_CHECKOUT: "true" });
    expect(flags.realCheckout).toBe(false);
    expect(flags.settlements).toBe(false);
    expect(flags.demoCheckout).toBe(false);
  });
  it("requires explicit opt in for browsing and local demo checkout", () => {
    expect(marketplaceFeatures({}).browse).toBe(false);
    expect(marketplaceFeatures({ MODE: "development", VITE_MARKETPLACE_BROWSE: "true", VITE_MARKETPLACE_DEMO_CHECKOUT: "true" })).toMatchObject({ browse: true, demoCheckout: true });
  });
});
