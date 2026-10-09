import type { Product } from "../types";

export type PriceSlab = {
  minQty: number;
  maxQty: number | null;
  pricePerUnit: number;
};

export type CatalogListing = {
  id: string;
  title: string;
  description: string;
  category: string;
  photos: string[];
  moq: number;
  unit: string;
  gst: number;
  leadTimeDays: number;
  priceSlabs: PriceSlab[];
  published: boolean;
  internalProductId?: string;
  titleLower: string;
  keywords: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CatalogDraft = Omit<CatalogListing, "id" | "photos" | "titleLower" | "keywords" | "createdAt" | "updatedAt">;

export type CatalogImportRow = CatalogDraft & {
  rowNumber: number;
  errors: string[];
};

export const catalogCategories = ["Storage & Crates", "Packaging", "Industrial Components", "Household", "Custom Manufacturing"];
export const catalogUnits = ["pcs", "kg", "set", "box", "roll"];

export const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase("en-IN");

export function buildKeywords(title: string, category: string, description: string): string[] {
  return [...new Set(`${title} ${category} ${description}`.toLocaleLowerCase("en-IN").match(/[a-z0-9]+/g) ?? [])].slice(0, 30);
}

export function validatePriceSlabs(slabs: PriceSlab[]): string[] {
  if (!slabs.length) return ["Add at least one price slab."];
  const errors: string[] = [];
  const sorted = [...slabs].sort((left, right) => left.minQty - right.minQty);
  sorted.forEach((slab, index) => {
    if (!Number.isFinite(slab.minQty) || slab.minQty < 1) errors.push(`Slab ${index + 1}: minimum quantity must be at least 1.`);
    if (slab.maxQty !== null && (!Number.isFinite(slab.maxQty) || slab.maxQty < slab.minQty)) errors.push(`Slab ${index + 1}: maximum quantity must be greater than or equal to minimum quantity.`);
    if (!Number.isFinite(slab.pricePerUnit) || slab.pricePerUnit <= 0) errors.push(`Slab ${index + 1}: price per unit must be greater than 0.`);
    const previous = sorted[index - 1];
    if (previous?.maxQty === null || (previous?.maxQty !== undefined && slab.minQty <= previous.maxQty)) errors.push(`Slab ${index + 1}: quantity range overlaps a previous slab.`);
  });
  return [...new Set(errors)];
}

export function validateCatalogDraft(draft: CatalogDraft): string[] {
  const errors: string[] = [];
  if (draft.title.trim().length < 3 || draft.title.trim().length > 120) errors.push("Title must be between 3 and 120 characters.");
  if (draft.description.trim().length < 10 || draft.description.trim().length > 2_000) errors.push("Description must be between 10 and 2,000 characters.");
  if (!draft.category.trim()) errors.push("Select a category.");
  if (!Number.isFinite(draft.moq) || draft.moq < 1) errors.push("MOQ must be at least 1.");
  if (!catalogUnits.includes(draft.unit)) errors.push("Select a valid unit.");
  if (!Number.isFinite(draft.gst) || draft.gst < 0 || draft.gst > 28) errors.push("GST must be between 0% and 28%.");
  if (!Number.isFinite(draft.leadTimeDays) || draft.leadTimeDays < 0 || draft.leadTimeDays > 365) errors.push("Lead time must be between 0 and 365 days.");
  return [...errors, ...validatePriceSlabs(draft.priceSlabs)];
}

export function createCatalogDraft(product?: Product): CatalogDraft {
  return {
    title: product?.name ?? "",
    description: "",
    category: product?.category ?? catalogCategories[0],
    moq: 1,
    unit: product?.unit && catalogUnits.includes(product.unit) ? product.unit : "pcs",
    gst: 18,
    leadTimeDays: 7,
    priceSlabs: [{ minQty: 1, maxQty: null, pricePerUnit: product?.sellingPrice ?? 0 }],
    published: false,
    internalProductId: product?.id,
  };
}
