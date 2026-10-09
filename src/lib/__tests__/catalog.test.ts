import { describe, expect, it } from "vitest";
import { buildKeywords, validateCatalogDraft, validatePriceSlabs } from "../catalog";

describe("catalog validation", () => {
  it("rejects overlapping price slabs", () => {
    expect(validatePriceSlabs([{ minQty: 1, maxQty: 100, pricePerUnit: 250 }, { minQty: 100, maxQty: null, pricePerUnit: 225 }])).toContain("Slab 2: quantity range overlaps a previous slab.");
  });

  it("accepts a valid marketplace listing draft", () => {
    expect(validateCatalogDraft({ title: "Industrial storage crate", description: "Heavy-duty reusable crate for industrial storage and dispatch.", category: "Storage & Crates", moq: 10, unit: "pcs", gst: 18, leadTimeDays: 7, priceSlabs: [{ minQty: 10, maxQty: null, pricePerUnit: 320 }], published: true })).toEqual([]);
  });

  it("builds normalized keywords for public search", () => {
    expect(buildKeywords("Blue Storage Crate", "Storage & Crates", "Heavy duty plastic")).toEqual(expect.arrayContaining(["blue", "storage", "crate", "heavy", "duty", "plastic"]));
  });
});
