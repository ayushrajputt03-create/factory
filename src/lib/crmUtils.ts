import type { Invoice } from "../types";

/**
 * Validates phone number (must be 10 digits)
 */
export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/[\s+\-()]/g, "");
  return /^\d{10}$/.test(clean);
}

/**
 * Validates GSTIN format (15 characters: 2 digits + 5 alpha + 4 digits + 1 alpha + 1 alpha/digit + Z + 1 alpha/digit)
 */
export function validateGSTIN(gstin?: string): boolean {
  if (!gstin || gstin.trim() === "") return true; // Optional field
  const clean = gstin.trim().toUpperCase();
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(clean);
}

/**
 * Checks if client is dormant (no order in 30+ days)
 */
export function isDormant(lastOrderDate?: string, referenceDateStr?: string): boolean {
  if (!lastOrderDate) return false;
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const orderDate = new Date(lastOrderDate);
  const diffTime = refDate.getTime() - orderDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 30;
}

/**
 * Checks if client's current balance exceeds credit limit
 */
export function isCreditLimitExceeded(balance: number, creditLimit: number): boolean {
  if (!creditLimit || creditLimit <= 0) return false;
  return balance > creditLimit;
}

export type AgingBuckets = {
  bucket0_30: number;
  bucket31_60: number;
  bucket61_90: number;
  bucket90Plus: number;
  totalOverdue60Plus: number;
};

/**
 * Calculates FIFO invoice aging buckets (0-30, 31-60, 61-90, 90+ days)
 * subtracts total payments received from oldest invoices first.
 */
export function calculateAgingBuckets(
  invoices: Invoice[],
  totalPayments: number,
  referenceDateStr?: string
): AgingBuckets {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();

  // Sort invoices oldest first by createdAt or dueDate
  const sortedInvoices = [...invoices].sort(
    (a, b) => new Date(a.createdAt || a.dueDate).getTime() - new Date(b.createdAt || b.dueDate).getTime()
  );

  let unallocatedPayment = totalPayments;

  let bucket0_30 = 0;
  let bucket31_60 = 0;
  let bucket61_90 = 0;
  let bucket90Plus = 0;

  for (const inv of sortedInvoices) {
    const invTotal = inv.total;
    let unpaidAmount = invTotal;

    if (unallocatedPayment > 0) {
      if (unallocatedPayment >= invTotal) {
        unallocatedPayment -= invTotal;
        unpaidAmount = 0;
      } else {
        unpaidAmount = invTotal - unallocatedPayment;
        unallocatedPayment = 0;
      }
    }

    if (unpaidAmount > 0) {
      const invDate = new Date(inv.createdAt || inv.dueDate);
      const diffTime = refDate.getTime() - invDate.getTime();
      const ageDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      if (ageDays <= 30) {
        bucket0_30 += unpaidAmount;
      } else if (ageDays <= 60) {
        bucket31_60 += unpaidAmount;
      } else if (ageDays <= 90) {
        bucket61_90 += unpaidAmount;
      } else {
        bucket90Plus += unpaidAmount;
      }
    }
  }

  return {
    bucket0_30,
    bucket31_60,
    bucket61_90,
    bucket90Plus,
    totalOverdue60Plus: bucket61_90 + bucket90Plus,
  };
}
