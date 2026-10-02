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
