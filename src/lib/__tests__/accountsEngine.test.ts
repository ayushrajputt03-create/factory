import { describe, it, expect } from "vitest";
import { dataService } from "../dataService";
import { mockStore } from "../mockStore";
import type { ExpenseCategory } from "../../types";

describe("Accounts Module — Internal Financial Tracking", () => {
  it("computes net position correctly (revenue - expenses)", () => {
    const summary = dataService.getAccountSummary();
    expect(summary.totalRevenue).toBeGreaterThan(0);
    expect(summary.totalExpenses).toBeGreaterThan(0);
    expect(summary.netPosition).toBe(summary.totalRevenue - summary.totalExpenses);
  });

  it("adds expenses across different categories and updates totals immediately", () => {
    const initialSummary = dataService.getAccountSummary();
    const initialExpCount = dataService.getExpenses().length;

    // 1. Add Rent expense
    const exp1 = dataService.addExpense({
      category: "rent",
      amount: 10000,
      paidTo: "Factory Landlord",
      expenseDate: "2026-10-01",
      note: "Warehouse extension rent",
    });
    expect(exp1.category).toBe("rent");
    expect(exp1.amount).toBe(10000);

    // 2. Add Electricity expense
    const exp2 = dataService.addExpense({
      category: "electricity",
      amount: 25000,
      paidTo: "Power Grid Corp",
      expenseDate: "2026-10-02",
      note: "Generator diesel & grid charges",
    });
    expect(exp2.category).toBe("electricity");
    expect(exp2.amount).toBe(25000);

    // 3. Add Maintenance expense
    const exp3 = dataService.addExpense({
      category: "maintenance",
      amount: 8000,
      paidTo: "Precision Tooling Service",
      expenseDate: "2026-10-03",
      note: "Mold cavity polishing",
    });
    expect(exp3.category).toBe("maintenance");
    expect(exp3.amount).toBe(8000);

    // Verify state & totals
    const newExpenses = dataService.getExpenses();
    expect(newExpenses.length).toBe(initialExpCount + 3);

    const updatedSummary = dataService.getAccountSummary();
    const addedAmount = 10000 + 25000 + 8000;
    expect(updatedSummary.totalExpenses).toBe(initialSummary.totalExpenses + addedAmount);
    expect(updatedSummary.netPosition).toBe(initialSummary.netPosition - addedAmount);

    // Verify category breakdown amounts
    expect(updatedSummary.categoryBreakdown.rent).toBeGreaterThanOrEqual(10000);
    expect(updatedSummary.categoryBreakdown.electricity).toBeGreaterThanOrEqual(25000);
    expect(updatedSummary.categoryBreakdown.maintenance).toBeGreaterThanOrEqual(8000);
  });

  it("validates required fields on expense entry", () => {
    expect(() => {
      dataService.addExpense({
        category: "other",
        amount: 0,
        paidTo: "Vendor",
      });
    }).toThrow("Expense amount must be greater than zero");

    expect(() => {
      dataService.addExpense({
        category: "salary",
        amount: 5000,
        paidTo: "   ",
      });
    }).toThrow("Payee name (paidTo) is required");
  });
});
