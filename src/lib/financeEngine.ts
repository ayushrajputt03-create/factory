export type FinanceRole = "owner" | "finance_manager" | "accountant" | "supervisor" | "storekeeper" | "operator";

export type JournalLine = {
  accountId: string;
  debitPaise: number;
  creditPaise: number;
  narration?: string;
};

export type JournalEntry = {
  id: string;
  factoryId: string;
  voucherNumber: string;
  date: string;
  narration: string;
  sourceModule: string;
  sourceRecordId?: string;
  status: "draft" | "posted" | "reversed";
  lines: JournalLine[];
  createdBy: string;
  createdAt: string;
};

export type AuditLog = {
  id: string;
  factoryId: string;
  userId: string;
  userName: string;
  role: FinanceRole;
  action: "create" | "edit" | "approve" | "reverse" | "payment" | "export";
  module: string;
  recordId: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
};

export const financePermissions: Record<FinanceRole, Record<string, boolean>> = {
  owner: { view: true, create: true, edit: true, approve: true, delete: true, export: true, settings: true, closeYear: true },
  finance_manager: { view: true, create: true, edit: true, approve: true, delete: false, export: true, settings: true, closeYear: false },
  accountant: { view: true, create: true, edit: true, approve: false, delete: false, export: true, settings: false, closeYear: false },
  supervisor: { view: false, costing: true, create: false, edit: false, approve: false, delete: false, export: false },
  storekeeper: { view: false, costing: true, create: false, edit: false, approve: false, delete: false, export: false },
  operator: { view: false, create: false, edit: false, approve: false, delete: false, export: false },
};

export const toPaise = (amount: number): number => Math.round(amount * 100);
export const fromPaise = (paise: number): number => paise / 100;
export const formatPaise = (paise: number): string => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(fromPaise(paise));

export type InvoiceLineInput = { quantity: number; ratePaise: number; discountType?: "percent" | "flat"; discountValue?: number; gstRate: number };
export type InvoiceTaxResult = {
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
};

const assertNonNegative = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be zero or greater.`);
};

export function calculateInvoiceTotals(lines: InvoiceLineInput[], sellerStateCode: string, customerStateCode: string, roundOffPaise = 0): InvoiceTaxResult {
  if (!lines.length) throw new Error("An invoice needs at least one line item.");
  const interstate = sellerStateCode.trim() !== customerStateCode.trim();
  let subtotalPaise = 0;
  let discountPaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  for (const line of lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Quantity must be greater than zero.");
    if (!Number.isFinite(line.ratePaise) || line.ratePaise < 0) throw new Error("Rate cannot be negative.");
    assertNonNegative(line.gstRate, "GST rate");
    const lineSubtotal = Math.round(line.quantity * line.ratePaise);
    const requestedDiscount = line.discountType === "percent"
      ? Math.round(lineSubtotal * (line.discountValue ?? 0) / 100)
      : Math.round(line.discountValue ?? 0);
    if (requestedDiscount > lineSubtotal) throw new Error("Discount cannot exceed line value.");
    const lineTaxable = lineSubtotal - requestedDiscount;
    subtotalPaise += lineSubtotal;
    discountPaise += requestedDiscount;
    const tax = Math.round(lineTaxable * line.gstRate / 100);
    if (interstate) igstPaise += tax;
    else {
      cgstPaise += Math.round(tax / 2);
      sgstPaise += tax - Math.round(tax / 2);
    }
  }
  const taxablePaise = subtotalPaise - discountPaise;
  const totalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise + roundOffPaise;
  return { subtotalPaise, discountPaise, taxablePaise, cgstPaise, sgstPaise, igstPaise, totalPaise };
}

export function calculateOutstandingPaise(totalPaise: number, paymentsPaise: number[]): number {
  assertNonNegative(totalPaise, "Invoice total");
  const paidPaise = paymentsPaise.reduce((sum, payment) => {
    if (!Number.isFinite(payment) || payment < 0) throw new Error("Payment cannot be negative.");
    return sum + payment;
  }, 0);
  if (paidPaise > totalPaise) throw new Error("Payment cannot exceed invoice total.");
  return totalPaise - paidPaise;
}

export function assertFinanceAccess(role: FinanceRole, permission: string): void {
  if (!financePermissions[role]?.[permission]) {
    throw new Error(`Role ${role} is not allowed to ${permission} finance records.`);
  }
}

export function assertBalancedJournal(lines: JournalLine[]): void {
  if (!lines.some((line) => line.debitPaise > 0) || !lines.some((line) => line.creditPaise > 0)) {
    throw new Error("A journal needs at least one debit and one credit line.");
  }
  const debit = lines.reduce((sum, line) => sum + line.debitPaise, 0);
  const credit = lines.reduce((sum, line) => sum + line.creditPaise, 0);
  if (debit !== credit) throw new Error("Journal debit and credit totals must match.");
  if (lines.some((line) => line.debitPaise < 0 || line.creditPaise < 0 || (line.debitPaise > 0 && line.creditPaise > 0))) {
    throw new Error("Each journal line must contain either a positive debit or a positive credit.");
  }
}

export function postJournalEntry(input: Omit<JournalEntry, "status">): JournalEntry {
  assertBalancedJournal(input.lines);
  return { ...input, status: "posted" };
}

export function createReversal(entry: JournalEntry, userId: string, timestamp = new Date().toISOString()): JournalEntry {
  return postJournalEntry({
    ...entry,
    id: `${entry.id}-reversal`,
    voucherNumber: `${entry.voucherNumber}-REV`,
    narration: `Reversal of ${entry.voucherNumber}: ${entry.narration}`,
    createdBy: userId,
    createdAt: timestamp,
    lines: entry.lines.map((line) => ({ ...line, debitPaise: line.creditPaise, creditPaise: line.debitPaise })),
  });
}

export function createAuditLog(input: Omit<AuditLog, "timestamp">, timestamp = new Date().toISOString()): AuditLog {
  return { ...input, timestamp };
}
