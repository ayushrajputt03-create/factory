import { describe, expect, it } from "vitest";
import { assertBalancedJournal, assertFinanceAccess, createReversal, postJournalEntry, toPaise } from "../financeEngine";

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
});
