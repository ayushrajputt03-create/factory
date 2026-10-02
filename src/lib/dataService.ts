import type {
  Bom,
  BomLineItem,
  BreakdownTicket,
  ClientCategory,
  ClientFollowUp,
  ClientInteraction,
  ClientStatus,
  Dispatch,
  InteractionType,
  Invoice,
  Machine,
  Material,
  MovementType,
  Order,
  Party,
  PartyType,
  PlantNotice,
  Product,
  ProductionEntry,
  QcInspection,
  QcInspectionStatus,
  Shift,
  StockMovement,
  WorkOrder,
  WorkOrderStatus,
} from "../types";
import { validateGSTIN, validatePhone } from "./crmUtils";
import { mockStore } from "./mockStore";

const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();

export const dataService = {
  // ==========================================
  // PRODUCTS
  // ==========================================
  getProducts(): Product[] {
    // TODO: FIREBASE -> const snapshot = await getDocs(collection(db, "factories", factoryId, "products"));
    // TODO: SUPABASE (later) -> const { data } = await supabase.from('products').select('*');
    return mockStore.getProducts();
  },

  createProduct(data: {
    name: string;
    unit: string;
    daily_target?: number;
    code?: string;
    category?: string;
    sellingPrice?: number;
  }): Product {
    // TODO: FIREBASE -> await addDoc(collection(db, "factories", factoryId, "products"), { name: data.name, unit: data.unit, dailyTarget: data.daily_target || 0 });
    // TODO: SUPABASE (later) -> await supabase.from('products').insert([{ factory_id: factoryId, name: data.name, unit: data.unit, daily_target: data.daily_target || 0 }]);

    const products = mockStore.getProducts();
    const cleanCode = data.code?.trim() || `FG-${data.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newProduct: Product = {
      id: createId("p"),
      code: cleanCode,
      name: data.name.trim(),
      category: data.category?.trim() || "General Finished Goods",
      unit: data.unit.trim() || "pcs",
      dailyTarget: Number(data.daily_target || 0),
      currentFinishedStock: 0,
      sellingPrice: Number(data.sellingPrice || 0),
    };

    const updated = [newProduct, ...products];
    mockStore.setProducts(updated);
    return newProduct;
  },

  // ==========================================
  // MATERIALS
  // ==========================================
  getMaterials(): Material[] {
    // TODO: FIREBASE -> const snapshot = await getDocs(collection(db, "factories", factoryId, "materials"));
    // TODO: SUPABASE (later) -> const { data } = await supabase.from('materials').select('*');
    return mockStore.getMaterials();
  },

  createMaterial(data: {
    name: string;
    unit: string;
    low_stock_threshold: number;
    current_stock: number;
    code?: string;
    category?: Material["category"];
    unitCost?: number;
  }): Material {
    // TODO: FIREBASE -> await addDoc(collection(db, "factories", factoryId, "materials"), { name: data.name, unit: data.unit, currentStock: data.current_stock, lowStockThreshold: data.low_stock_threshold });
    // TODO: SUPABASE (later) -> await supabase.from('materials').insert([{ factory_id: factoryId, name: data.name, unit: data.unit, current_stock: data.current_stock, low_stock_threshold: data.low_stock_threshold }]);

    const materials = mockStore.getMaterials();
    const cleanCode = data.code?.trim() || `RM-${data.name.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const newMaterial: Material = {
      id: createId("m"),
      code: cleanCode,
      name: data.name.trim(),
      category: data.category || "Raw Material",
      unit: data.unit.trim() || "kg",
      currentStock: Number(data.current_stock || 0),
      lowStockThreshold: Number(data.low_stock_threshold || 0),
      unitCost: Number(data.unitCost || 0),
    };

    const updated = [newMaterial, ...materials];
    mockStore.setMaterials(updated);

    if (newMaterial.currentStock > 0) {
      const movements = mockStore.getStockMovements();
      const openingMovement: StockMovement = {
        id: createId("sm"),
        materialId: newMaterial.id,
        type: "in",
        quantity: newMaterial.currentStock,
        note: `Initial Opening Stock for ${newMaterial.name}`,
        createdBy: "Owner",
        createdAt: nowIso(),
      };
      mockStore.setStockMovements([openingMovement, ...movements]);
    }

    return newMaterial;
  },

  // ==========================================
  // BOMS (BILL OF MATERIALS)
  // ==========================================
  getBoms(): Bom[] {
    // TODO: FIREBASE -> const snapshot = await getDocs(collection(db, "factories", factoryId, "boms"));
    // TODO: SUPABASE (later) -> const { data } = await supabase.from('boms').select('*, bom_line_items(*)');
    return mockStore.getBoms();
  },

  getActiveBom(productId: string): Bom | undefined {
    const boms = mockStore.getBoms();
    return boms.find((b) => b.productId === productId && b.isActive);
  },

  saveBom(productId: string, lineItems: BomLineItem[]): Bom {
    const allBoms = mockStore.getBoms();
    const productBoms = allBoms.filter((b) => b.productId === productId);
    const highestVersion = productBoms.reduce((max, b) => Math.max(max, b.version), 0);
    const nextVersion = highestVersion + 1;

    const deactivatedBoms = allBoms.map((b) =>
      b.productId === productId ? { ...b, isActive: false } : b
    );

    const newBom: Bom = {
      id: createId("bom"),
      productId,
      version: nextVersion,
      isActive: true,
      createdAt: nowIso(),
      lineItems: lineItems.filter((item) => item.materialId && item.qtyPerUnit > 0),
    };

    const updated = [newBom, ...deactivatedBoms];
    mockStore.setBoms(updated);
    return newBom;
  },

  // ==========================================
  // PRODUCTION ENTRIES & DEDUCTION
  // ==========================================
  getProductionEntries(): ProductionEntry[] {
    return mockStore.getProductionEntries();
  },

  recordProductionEntry(entryData: {
    productId: string;
    quantityProduced: number;
    quantityRejected: number;
    rejectReason?: string;
    shift: Shift;
    machineId?: string;
    downtimeMinutes?: number;
    downtimeReason?: string;
    enteredBy?: string;
  }): { entry: ProductionEntry; movements: StockMovement[] } {
    const products = mockStore.getProducts();
    const materials = mockStore.getMaterials();
    const activeBom = this.getActiveBom(entryData.productId);
    const product = products.find((p) => p.id === entryData.productId);

    const entryId = createId("pe");
    const createdAt = nowIso();

    const newEntry: ProductionEntry = {
      id: entryId,
      productId: entryData.productId,
      bomId: activeBom?.id || "",
      quantityProduced: entryData.quantityProduced,
      quantityRejected: entryData.quantityRejected || 0,
      rejectReason: entryData.rejectReason?.trim() || "",
      shift: entryData.shift,
      machineId: entryData.machineId || "Workstation #1",
      downtimeMinutes: entryData.downtimeMinutes || 0,
      downtimeReason: entryData.downtimeReason?.trim() || "",
      entryDate: today(),
      enteredBy: entryData.enteredBy || "Supervisor",
      createdAt,
    };

    const movements: StockMovement[] = [];

    if (activeBom && activeBom.lineItems.length > 0) {
      activeBom.lineItems.forEach((line) => {
        const mat = materials.find((m) => m.id === line.materialId);
        const deductQty = Number((line.qtyPerUnit * entryData.quantityProduced).toFixed(3));

        const movement: StockMovement = {
          id: createId("sm"),
          materialId: line.materialId,
          type: "production_deduction",
          quantity: deductQty,
          referenceId: entryId,
          note: `Auto-deducted for ${entryData.quantityProduced} ${product?.unit || "units"} of ${product?.name || "Product"}`,
          createdBy: entryData.enteredBy || "Supervisor",
          createdAt,
        };
        movements.push(movement);

        if (mat) {
          mat.currentStock = Number(Math.max(0, mat.currentStock - deductQty).toFixed(3));
        }
      });
      mockStore.setMaterials([...materials]);
    }

    if (product) {
      product.currentFinishedStock += entryData.quantityProduced;
      mockStore.setProducts([...products]);
    }

    const entries = mockStore.getProductionEntries();
    mockStore.setProductionEntries([newEntry, ...entries]);

    if (movements.length > 0) {
      const allMovements = mockStore.getStockMovements();
      mockStore.setStockMovements([...movements, ...allMovements]);
    }

    return { entry: newEntry, movements };
  },

  // ==========================================
  // MACHINES & BREAKDOWN WORKFLOW (SECTION 8.2)
  // ==========================================
  getMachines(): Machine[] {
    return mockStore.getMachines();
  },

  getBreakdownTickets(): BreakdownTicket[] {
    return mockStore.getBreakdownTickets();
  },

  reportBreakdown(data: {
    machineId: string;
    symptom: string;
    severity: "Urgent" | "High" | "Normal";
    reportedBy: string;
  }): BreakdownTicket {
    // TODO: FIREBASE -> Cloud Function transaction: set machine status = "Breakdown" & add breakdown ticket
    // TODO: SUPABASE (later) -> RPC function report_machine_breakdown(...)
    const machines = mockStore.getMachines();
    const mch = machines.find((m) => m.id === data.machineId);

    if (mch) {
      mch.status = "Breakdown";
      mch.lastBreakdownReason = data.symptom;
      mockStore.setMachines([...machines]);
    }

    const ticket: BreakdownTicket = {
      id: createId("brk"),
      machineId: data.machineId,
      symptom: data.symptom.trim(),
      severity: data.severity,
      reportedBy: data.reportedBy,
      stoppedTime: nowIso(),
      status: "In Repair",
    };

    const tickets = mockStore.getBreakdownTickets();
    mockStore.setBreakdownTickets([ticket, ...tickets]);
    return ticket;
  },

  resolveBreakdown(ticketId: string): void {
    const tickets = mockStore.getBreakdownTickets();
    const ticket = tickets.find((t) => t.id === ticketId);

    if (ticket) {
      ticket.status = "Resolved";
      mockStore.setBreakdownTickets([...tickets]);

      const machines = mockStore.getMachines();
      const mch = machines.find((m) => m.id === ticket.machineId);
      if (mch) {
        mch.status = "Running";
        mockStore.setMachines([...machines]);
      }
    }
  },

  // ==========================================
  // WORK ORDERS PIPELINE (SECTION 8.1)
  // ==========================================
  getWorkOrders(): WorkOrder[] {
    return mockStore.getWorkOrders();
  },

  createWorkOrder(data: WorkOrder | {
    productId: string;
    quantityOrdered: number;
    dueDate: string;
    assignedMachineId: string;
    assignedOperator: string;
  }): WorkOrder {
    const woList = mockStore.getWorkOrders();
    // If a full WorkOrder object is passed, use it directly
    if ("id" in data && data.id) {
      mockStore.setWorkOrders([data as WorkOrder, ...woList]);
      return data as WorkOrder;
    }
    // Otherwise build one from the minimal data shape
    const d = data as { productId: string; quantityOrdered: number; dueDate: string; assignedMachineId: string; assignedOperator: string };
    const woNum = `WO-26-${400 + woList.length + 1}`;
    const newWo: WorkOrder = {
      id: createId("wo"),
      workOrderNumber: woNum,
      orderNumber: woNum,
      productId: d.productId,
      quantityOrdered: d.quantityOrdered,
      quantity: d.quantityOrdered,
      quantityCompleted: 0,
      status: "Released",
      dueDate: d.dueDate,
      assignedMachineId: d.assignedMachineId,
      assignedOperator: d.assignedOperator,
      materialReadiness: "Ready",
      stage: "Injection Molding",
      createdAt: nowIso(),
    };

    mockStore.setWorkOrders([newWo, ...woList]);
    return newWo;
  },

  updateWorkOrderStatus(id: string, status: WorkOrderStatus): void {
    const woList = mockStore.getWorkOrders();
    const updated = woList.map((w) => (w.id === id ? { ...w, status } : w));
    mockStore.setWorkOrders(updated);
  },

  // ==========================================
  // QUALITY CONTROL (SECTION 4)
  // ==========================================
  getQcInspections(): QcInspection[] {
    return mockStore.getQcInspections();
  },

  recordQcInspection(data: {
    batchNumber: string;
    productId: string;
    inspectedQuantity: number;
    passedQuantity: number;
    rejectedQuantity: number;
    defectCode: string;
    status: QcInspectionStatus;
    inspector: string;
    notes?: string;
  }): QcInspection {
    const list = mockStore.getQcInspections();
    const newQc: QcInspection = {
      id: createId("qc"),
      batchNumber: data.batchNumber.trim(),
      productId: data.productId,
      inspectedQuantity: data.inspectedQuantity,
      inspectedQty: data.inspectedQuantity,
      passedQuantity: data.passedQuantity,
      passedQty: data.passedQuantity,
      rejectedQuantity: data.rejectedQuantity,
      rejectedQty: data.rejectedQuantity,
      defectCode: data.defectCode,
      status: data.status,
      inspector: data.inspector,
      date: today(),
      inspectedAt: nowIso(),
      notes: data.notes?.trim() || "",
    };

    mockStore.setQcInspections([newQc, ...list]);
    return newQc;
  },


  // ==========================================
  // CLIENT CRM & PARTIES
  // ==========================================
  getParties(): Party[] {
    return mockStore.getParties();
  },

  createClient(data: {
    name: string;
    phone: string;
    type?: PartyType;
    clientCategory?: ClientCategory;
    whatsapp?: string;
    city?: string;
    gstin?: string;
    tags?: string[];
    creditLimit?: number;
    payment_terms_days?: number;
    status?: ClientStatus;
    notes?: string;
  }): Party {
    if (!validatePhone(data.phone)) {
      throw new Error("Phone number must be exactly 10 digits");
    }
    if (data.gstin && !validateGSTIN(data.gstin)) {
      throw new Error("Invalid GSTIN format (must be 15 alphanumeric characters)");
    }

    const parties = mockStore.getParties();
    const newParty: Party = {
      id: createId("party"),
      name: data.name.trim(),
      type: data.type || "Customer",
      clientCategory: data.clientCategory || "dealer",
      phone: data.phone.trim(),
      whatsapp: data.whatsapp?.trim() || data.phone.trim(),
      city: data.city?.trim() || "Jaipur",
      gstin: data.gstin?.trim().toUpperCase() || "",
      tags: data.tags || ["New Lead"],
      creditLimit: Number(data.creditLimit || 100000),
      creditPeriodDays: Number(data.payment_terms_days || 15),
      status: data.status || "lead",
      notes: data.notes?.trim() || "",
      lastOrderDate: "",
      lastPaymentDate: "",
    };

    const updated = [newParty, ...parties];
    mockStore.setParties(updated);
    return newParty;
  },

  // ==========================================
  // INTERACTIONS (TIMELINE LOG)
  // ==========================================
  listInteractions(clientId: string): ClientInteraction[] {
    const all = mockStore.getInteractions();
    return all
      .filter((i) => i.clientId === clientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  addInteraction(clientId: string, data: { type: InteractionType; text: string; createdBy?: string }): ClientInteraction {
    const all = mockStore.getInteractions();
    const newInteraction: ClientInteraction = {
      id: createId("int"),
      clientId,
      type: data.type,
      text: data.text.trim(),
      createdBy: data.createdBy || "Ayush Rajput (Owner)",
      timestamp: nowIso(),
    };

    mockStore.setInteractions([newInteraction, ...all]);
    return newInteraction;
  },

  // ==========================================
  // FOLLOW-UPS / TASKS
  // ==========================================
  listDueFollowUps(dateStr?: string): ClientFollowUp[] {
    const all = mockStore.getFollowUps();
    const targetDate = dateStr || today();
    return all.filter((f) => !f.done && f.dueDate <= targetDate);
  },

  createFollowUp(clientId: string, data: { dueDate: string; reason: string; autoSuggested?: boolean }): ClientFollowUp {
    const all = mockStore.getFollowUps();
    const newFollowUp: ClientFollowUp = {
      id: createId("fu"),
      clientId,
      dueDate: data.dueDate,
      reason: data.reason.trim(),
      done: false,
      createdAt: nowIso(),
      autoSuggested: data.autoSuggested || false,
    };

    mockStore.setFollowUps([newFollowUp, ...all]);
    return newFollowUp;
  },

  completeFollowUp(followUpId: string): void {
    const all = mockStore.getFollowUps();
    const updated = all.map((f) => (f.id === followUpId ? { ...f, done: true } : f));
    mockStore.setFollowUps(updated);
  },

  // ==========================================
  // STOCK MOVEMENTS, INVOICES & DISPATCHES
  // ==========================================
  getStockMovements(): StockMovement[] {
    return mockStore.getStockMovements();
  },

  recordStockMovement(data: {
    materialId: string;
    type: "in" | "out";
    quantity: number;
    note?: string;
    createdBy?: string;
  }): StockMovement {
    const materials = mockStore.getMaterials();
    const mat = materials.find((m) => m.id === data.materialId);
    if (!mat) throw new Error("Material not found");

    const movement: StockMovement = {
      id: createId("sm"),
      materialId: mat.id,
      type: data.type,
      quantity: data.quantity,
      note: data.note?.trim() || (data.type === "in" ? "Purchase Inward" : "Manual Stock Issue"),
      createdBy: data.createdBy || "Owner",
      createdAt: nowIso(),
    };

    if (data.type === "in") {
      mat.currentStock = Number((mat.currentStock + data.quantity).toFixed(3));
    } else {
      mat.currentStock = Number(Math.max(0, mat.currentStock - data.quantity).toFixed(3));
    }

    mockStore.setMaterials([...materials]);
    const movements = mockStore.getStockMovements();
    mockStore.setStockMovements([movement, ...movements]);

    return movement;
  },

  getInvoices(): Invoice[] {
    return mockStore.getInvoices();
  },

  getLedgerEntries() {
    return mockStore.getLedgerEntries();
  },

  getOrders(): Order[] {
    return mockStore.getOrders();
  },

  getDispatches(): Dispatch[] {
    return mockStore.getDispatches();
  },

  getNotices(): PlantNotice[] {
    return mockStore.getNotices();
  },
};
