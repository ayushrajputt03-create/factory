import { describe, expect, it } from "vitest";
import type { Invoice } from "../../types";
import {
  calculateAgingBuckets,
  isCreditLimitExceeded,
  isDormant,
  validateGSTIN,
  validatePhone,
} from "../crmUtils";

describe("CRM Pure Utilities", () => {
  describe("validatePhone", () => {
    it("should accept valid 10 digit Indian phone numbers", () => {
      expect(validatePhone("9829012345")).toBe(true);
      expect(validatePhone("9811223344")).toBe(true);
    });

    it("should reject invalid phone lengths and non-numeric strings", () => {
      expect(validatePhone("982901234")).toBe(false); // 9 digits
      expect(validatePhone("98290123456")).toBe(false); // 11 digits
      expect(validatePhone("abcdefghij")).toBe(false);
    });
  });

  describe("validateGSTIN", () => {
    it("should allow empty/undefined GSTIN since it is optional", () => {
      expect(validateGSTIN("")).toBe(true);
      expect(validateGSTIN(undefined)).toBe(true);
    });

    it("should validate correct 15-character GSTIN format", () => {
      expect(validateGSTIN("08AABCJ1020A1Z5")).toBe(true);
      expect(validateGSTIN("24AABCR2401G1Z3")).toBe(true);
    });

    it("should reject invalid GSTIN format", () => {
      expect(validateGSTIN("INVALIDGSTIN123")).toBe(false);
      expect(validateGSTIN("123456789012345")).toBe(false);
    });
  });

  describe("isDormant", () => {
    it("should flag dormant client if no order in 30+ days", () => {
      const refDate = "2026-10-01";
      const oldOrderDate = "2026-08-15"; // 47 days old
      expect(isDormant(oldOrderDate, refDate)).toBe(true);
    });

    it("should return false if order was placed within 30 days", () => {
      const refDate = "2026-10-01";
      const recentOrderDate = "2026-09-20"; // 11 days old
      expect(isDormant(recentOrderDate, refDate)).toBe(false);
    });
  });

  describe("isCreditLimitExceeded", () => {
    it("should return true when balance exceeds credit limit", () => {
      expect(isCreditLimitExceeded(250000, 200000)).toBe(true);
    });

    it("should return false when balance is within credit limit", () => {
      expect(isCreditLimitExceeded(150000, 200000)).toBe(false);
      expect(isCreditLimitExceeded(200000, 200000)).toBe(false);
    });
  });

  describe("calculateAgingBuckets (FIFO Allocation)", () => {
    it("should classify 70-day old unpaid invoice into 61-90 bucket", () => {
      const refDate = "2026-10-01";
      const invoices: Invoice[] = [
        {
          id: "inv-1",
          partyId: "p1",
          invoiceNumber: "INV-101",
          items: [],
          subtotal: 10000,
          gstAmount: 1800,
          total: 11800,
          status: "sent",
          dueDate: "2026-07-23",
          createdAt: "2026-07-23T10:00:00.000Z", // 70 days old from Oct 1
        },
      ];

      const buckets = calculateAgingBuckets(invoices, 0, refDate);
      expect(buckets.bucket61_90).toBe(11800);
      expect(buckets.bucket0_30).toBe(0);
      expect(buckets.totalOverdue60Plus).toBe(11800);
    });

    it("should reduce oldest invoice first via FIFO allocation of payments", () => {
      const refDate = "2026-10-01";
      const invoices: Invoice[] = [
        {
          id: "inv-old",
          partyId: "p1",
          invoiceNumber: "INV-OLD",
          items: [],
          subtotal: 10000,
          gstAmount: 0,
          total: 10000,
          status: "sent",
          dueDate: "2026-06-01",
          createdAt: "2026-06-01T10:00:00.000Z", // 122 days old (90+ bucket)
        },
        {
          id: "inv-new",
          partyId: "p1",
          invoiceNumber: "INV-NEW",
          items: [],
          subtotal: 15000,
          gstAmount: 0,
          total: 15000,
          status: "sent",
          dueDate: "2026-09-20",
          createdAt: "2026-09-20T10:00:00.000Z", // 11 days old (0-30 bucket)
        },
      ];

      // Payment of 12,000 should clear the 10,000 old invoice completely and reduce 2,000 from the new invoice
      const buckets = calculateAgingBuckets(invoices, 12000, refDate);
      expect(buckets.bucket90Plus).toBe(0); // cleared completely
      expect(buckets.bucket0_30).toBe(13000); // 15000 - 2000 remaining
    });
  });
});
