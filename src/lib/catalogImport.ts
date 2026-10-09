import * as XLSX from "xlsx";
import { buildKeywords, type CatalogImportRow, type CatalogDraft, validateCatalogDraft } from "./catalog";

type ImportSource = Record<string, unknown>;

const getText = (row: ImportSource, name: string) => String(row[name] ?? "").trim();
const getNumber = (row: ImportSource, name: string, fallback = 0) => {
  const value = Number(String(row[name] ?? "").replace(/,/g, ""));
  return Number.isFinite(value) ? value : fallback;
};

export async function parseCatalogImport(file: File): Promise<CatalogImportRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("The import file does not contain a worksheet.");
  const rows = XLSX.utils.sheet_to_json<ImportSource>(firstSheet, { defval: "" });
  if (rows.length > 500) throw new Error("Import up to 500 listings at a time.");
  return rows.map((row, index) => {
    const maxQty = getText(row, "maxQty");
    const draft: CatalogDraft = {
      title: getText(row, "title"),
      description: getText(row, "description"),
      category: getText(row, "category"),
      moq: getNumber(row, "moq"),
      unit: getText(row, "unit"),
      gst: getNumber(row, "gst"),
      leadTimeDays: getNumber(row, "leadTimeDays"),
      priceSlabs: [{ minQty: getNumber(row, "minQty", 1), maxQty: maxQty ? getNumber(row, "maxQty") : null, pricePerUnit: getNumber(row, "pricePerUnit") }],
      published: ["true", "yes", "published"].includes(getText(row, "published").toLowerCase()),
      internalProductId: getText(row, "internalProductId") || undefined,
    };
    return { ...draft, rowNumber: index + 2, errors: validateCatalogDraft(draft) };
  });
}

export function catalogImportRowToPayload(row: CatalogImportRow) {
  const { rowNumber, errors, ...draft } = row;
  return { ...draft, titleLower: draft.title.toLowerCase(), keywords: buildKeywords(draft.title, draft.category, draft.description) };
}
