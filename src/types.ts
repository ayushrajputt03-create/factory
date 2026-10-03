export type Shift = "Morning (08:00 - 16:00)" | "Evening (16:00 - 00:00)" | "Night (00:00 - 08:00)";
export type MovementType = "in" | "out" | "production_deduction";
export type PartyType = "Customer" | "Supplier";
export type ClientCategory = "dealer" | "retailer" | "direct";
export type ClientStatus = "lead" | "active" | "dormant" | "blocked";
export type InteractionType = "call" | "visit" | "whatsapp" | "note";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled";
export type OrderStatus = "open" | "dispatched" | "in_transit" | "delivered";
export type LedgerEntryType = "debit" | "credit";

export type WorkOrderStatus = "Draft" | "Released" | "In Progress" | "On Hold" | "Completed" | "Closed";
export type MachineStatus = "Running" | "Idle" | "Breakdown" | "Maintenance";
export type QcInspectionStatus = "Pending" | "Passed" | "On Hold" | "Rejected";
export type UserRole = "owner" | "plant_manager" | "supervisor" | "operator" | "storekeeper" | "qc_inspector" | "accountant" | "logistics";

export type Material = {
  id: string;
  code: string;
  name: string;
  category: "Raw Material" | "Color / Additive" | "Packaging" | "Consumable";
  unit: string;
  currentStock: number;
  lowStockThreshold: number;
  unitCost: number;
};

export type Product = {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  dailyTarget: number;
  currentFinishedStock: number;
  sellingPrice: number;
};

export type BomLineItem = {
  materialId: string;
  qtyPerUnit: number;
};

export type Bom = {
  id: string;
  productId: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  lineItems: BomLineItem[];
};

export type ProductionEntry = {
  id: string;
  productId: string;
  bomId: string;
  quantityProduced: number;
  quantityRejected: number;
  rejectReason: string;
  shift: Shift;
  machineId: string;
  downtimeMinutes: number;
  downtimeReason: string;
  entryDate: string;
  enteredBy: string;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  materialId: string;
  type: MovementType;
  quantity: number;
  referenceId?: string;
  note: string;
  createdBy: string;
  createdAt: string;
};

export type WorkOrder = {
  id: string;
  workOrderNumber: string;
  orderNumber: string; // alias for display (same as workOrderNumber)
  productId: string;
  quantityOrdered: number;
  quantity: number; // alias for quantityOrdered
  quantityCompleted: number;
  status: WorkOrderStatus;
  dueDate: string;
  assignedMachineId: string;
  assignedOperator: string;
  materialReadiness: "Ready" | "Shortage Risk" | "Not Allocated";
  stage: "Tooling Setup" | "Injection Molding" | "Trimming & QC" | "Packing";
  priority?: "Urgent" | "High" | "Normal";
  notes?: string;
  createdBy?: string;
  createdAt: string;
};

export type Machine = {
  id: string;
  name: string;
  code: string;
  type?: string;
  location?: string;
  status: MachineStatus;
  currentJob: string;
  operator: string;
  currentOperator?: string; // alias for operator
  runtimeHours: number;
  nextMaintenanceDate: string;
  lastBreakdownReason?: string;
};

export type BreakdownTicket = {
  id: string;
  machineId: string;
  symptom: string;
  severity: "Urgent" | "High" | "Normal";
  reportedBy: string;
  stoppedTime: string;
  status: "Open" | "In Repair" | "Resolved";
};

export type QcInspection = {
  id: string;
  batchNumber: string;
  productId: string;
  inspectedQuantity: number;
  inspectedQty: number; // alias
  passedQuantity: number;
  passedQty: number; // alias
  rejectedQuantity: number;
  rejectedQty: number; // alias
  defectCode: string;
  status: QcInspectionStatus;
  inspector: string;
  date: string;
  inspectedAt?: string; // ISO timestamp alias for date
  notes: string;
};


export type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  materialId: string;
  quantity: number;
  expectedDate: string;
  receivedQuantity: number;
  status: "Issued" | "Partial Received" | "Fully Received" | "Cancelled";
  paymentState: "Unpaid" | "Partial" | "Paid";
};

export type Employee = {
  id: string;
  name: string;
  role: "Owner" | "Plant Manager" | "Supervisor" | "Operator" | "Storekeeper" | "QC Inspector" | "Accountant" | "Logistics";
  assignedShift: Shift | string;
  attendanceStatus: "Present" | "Absent" | "On Leave";
  phone: string;
};

export type Party = {
  id: string;
  name: string;
  type: PartyType;
  clientCategory?: ClientCategory;
  phone: string;
  whatsapp?: string;
  city: string;
  gstin: string;
  tags?: string[];
  creditLimit: number;
  creditPeriodDays: number;
  status?: ClientStatus;
  notes?: string;
  lastOrderDate: string;
  lastPaymentDate: string;
};

export type ClientInteraction = {
  id: string;
  clientId: string;
  type: InteractionType;
  text: string;
  createdBy: string;
  timestamp: string;
};

export type ClientFollowUp = {
  id: string;
  clientId: string;
  dueDate: string;
  reason: string;
  done: boolean;
  createdAt: string;
  autoSuggested?: boolean;
};

export type InvoiceItem = {
  productId: string;
  quantity: number;
  rate: number;
  gstRate: number;
};

export type Invoice = {
  id: string;
  partyId: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  subtotal: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
};

export type LedgerEntry = {
  id: string;
  partyId: string;
  invoiceId?: string;
  amount: number;
  type: LedgerEntryType;
  date: string;
  note: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  partyId: string;
  invoiceId?: string;
  items: InvoiceItem[];
  status: OrderStatus;
  createdAt: string;
};

export type Dispatch = {
  id: string;
  orderId: string;
  orderNumber: string;
  partyName: string;
  transportProvider: string;
  trackingId: string;
  vehicleType: string;
  cost: number;
  status: Extract<OrderStatus, "dispatched" | "in_transit" | "delivered">;
  createdAt: string;
};

export type PlantNotice = {
  id: string;
  title: string;
  content: string;
  targetShift: "All Shifts" | "Morning Shift" | "Maintenance Team" | "Quality Dept";
  priority: "Urgent" | "High" | "Normal";
  date: string;
  issuedBy: string;
};

export type ExpenseCategory =
  | "rent"
  | "electricity"
  | "maintenance"
  | "raw_material"
  | "salary"
  | "other";

export type Expense = {
  id: string;
  factoryId: string;
  category: ExpenseCategory;
  amount: number;
  paidTo: string;
  expenseDate: string;
  note?: string;
  createdBy: string;
  createdAt: string;
};

export type AccountSummary = {
  totalRevenue: number;
  totalExpenses: number;
  netPosition: number;
  categoryBreakdown: Record<ExpenseCategory, number>;
};

