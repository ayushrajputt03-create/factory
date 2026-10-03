import { describe, expect, it } from "vitest";
import { assertBalancedJournal, assertFinanceAccess, calculateInvoiceTotals, calculateOutstandingPaise, createReversal, postJournalEntry, toPaise } from "../financeEngine";

describe("Finance foundation", () => {
  const lines = [
    { accountId: "ar", debitPaise: toPaise(100), creditPaise: 0 },
    { accountId: "sales", debitPaise: 0, creditPaise: toPaise(100) },
  ];

  it("stores money as integer paise and posts a balanced journal", () => {
    const entry = postJournalEntry({
      id: "je-1", factoryId: "factory-1", voucherNumber: "JV-0001", date: "2026-10-02",
      narration: "Test sale", sourceModule: "sales", createdBy: "user-1", createdAt: "2026-10-02T00:00:00.000Z", lines,
    });
    expect(entry.status).toBe("posted");
    expect(lines[0].debitPaise).toBe(10000);
    expect(createReversal(entry, "user-1").lines[0].creditPaise).toBe(10000);
  });

  it("rejects unbalanced journals", () => {
    expect(() => assertBalancedJournal([{ accountId: "cash", debitPaise: 100, creditPaise: 0 }])).toThrow();
  });

  it("blocks roles without finance access", () => {
    expect(() => assertFinanceAccess("operator", "view")).toThrow();
    expect(() => assertFinanceAccess("accountant", "create")).not.toThrow();
  });

  it("splits intra-state GST into CGST and SGST", () => {
    const result = calculateInvoiceTotals([{ quantity: 2, ratePaise: toPaise(100), gstRate: 18 }], "08", "08");
    expect(result.subtotalPaise).toBe(20000);
    expect(result.cgstPaise).toBe(1800);
    expect(result.sgstPaise).toBe(1800);
    expect(result.igstPaise).toBe(0);
    expect(result.totalPaise).toBe(23600);
  });

  it("uses IGST for inter-state invoices and computes outstanding balance", () => {
    const result = calculateInvoiceTotals([{ quantity: 1, ratePaise: toPaise(1000), discountType: "percent", discountValue: 10, gstRate: 18 }], "08", "09");
    expect(result.igstPaise).toBe(16200);
    expect(result.cgstPaise).toBe(0);
    expect(calculateOutstandingPaise(result.totalPaise, [toPaise(500)])).toBe(56200);
  });

  it("rejects overpayment and excessive discounts", () => {
    expect(() => calculateOutstandingPaise(1000, [1001])).toThrow();
    expect(() => calculateInvoiceTotals([{ quantity: 1, ratePaise: 1000, discountType: "flat", discountValue: 1001, gstRate: 0 }], "08", "08")).toThrow();
  });
});
