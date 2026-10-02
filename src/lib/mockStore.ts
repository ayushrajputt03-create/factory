import {
  initialBoms,
  initialBreakdownTickets,
  initialDispatches,
  initialFollowUps,
  initialInvoices,
  initialInteractions,
  initialLedgerEntries,
  initialMachines,
  initialMaterials,
  initialNotices,
  initialOrders,
  initialParties,
  initialProductionEntries,
  initialProducts,
  initialQcInspections,
  initialStockMovements,
  initialWorkOrders,
} from "../seed";
import type {
  Bom,
  BreakdownTicket,
  ClientFollowUp,
  ClientInteraction,
  Dispatch,
  Invoice,
  LedgerEntry,
  Machine,
  Material,
  Order,
  Party,
  PlantNotice,
  Product,
  ProductionEntry,
  QcInspection,
  StockMovement,
  WorkOrder,
} from "../types";

const STORAGE_KEYS = {
  MATERIALS: "factory_os_materials",
  PRODUCTS: "factory_os_products",
  BOMS: "factory_os_boms",
  PRODUCTION_ENTRIES: "factory_os_production_entries",
  STOCK_MOVEMENTS: "factory_os_stock_movements",
  PARTIES: "factory_os_parties",
  INTERACTIONS: "factory_os_interactions",
  FOLLOWUPS: "factory_os_followups",
  INVOICES: "factory_os_invoices",
  LEDGER_ENTRIES: "factory_os_ledger_entries",
  ORDERS: "factory_os_orders",
  DISPATCHES: "factory_os_dispatches",
  NOTICES: "factory_os_notices",
  MACHINES: "factory_os_machines",
  BREAKDOWNS: "factory_os_breakdowns",
  WORK_ORDERS: "factory_os_work_orders",
  QC_INSPECTIONS: "factory_os_qc_inspections",
};

function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("localStorage write error:", err);
  }
}

export const mockStore = {
  getMaterials: (): Material[] => getStorage(STORAGE_KEYS.MATERIALS, initialMaterials),
  setMaterials: (data: Material[]) => setStorage(STORAGE_KEYS.MATERIALS, data),

  getProducts: (): Product[] => getStorage(STORAGE_KEYS.PRODUCTS, initialProducts),
  setProducts: (data: Product[]) => setStorage(STORAGE_KEYS.PRODUCTS, data),

  getBoms: (): Bom[] => getStorage(STORAGE_KEYS.BOMS, initialBoms),
  setBoms: (data: Bom[]) => setStorage(STORAGE_KEYS.BOMS, data),

  getProductionEntries: (): ProductionEntry[] => getStorage(STORAGE_KEYS.PRODUCTION_ENTRIES, initialProductionEntries),
  setProductionEntries: (data: ProductionEntry[]) => setStorage(STORAGE_KEYS.PRODUCTION_ENTRIES, data),

  getStockMovements: (): StockMovement[] => getStorage(STORAGE_KEYS.STOCK_MOVEMENTS, initialStockMovements),
  setStockMovements: (data: StockMovement[]) => setStorage(STORAGE_KEYS.STOCK_MOVEMENTS, data),

  getParties: (): Party[] => getStorage(STORAGE_KEYS.PARTIES, initialParties),
  setParties: (data: Party[]) => setStorage(STORAGE_KEYS.PARTIES, data),

  getInteractions: (): ClientInteraction[] => getStorage(STORAGE_KEYS.INTERACTIONS, initialInteractions),
  setInteractions: (data: ClientInteraction[]) => setStorage(STORAGE_KEYS.INTERACTIONS, data),

  getFollowUps: (): ClientFollowUp[] => getStorage(STORAGE_KEYS.FOLLOWUPS, initialFollowUps),
  setFollowUps: (data: ClientFollowUp[]) => setStorage(STORAGE_KEYS.FOLLOWUPS, data),

  getInvoices: (): Invoice[] => getStorage(STORAGE_KEYS.INVOICES, initialInvoices),
  setInvoices: (data: Invoice[]) => setStorage(STORAGE_KEYS.INVOICES, data),

  getLedgerEntries: (): LedgerEntry[] => getStorage(STORAGE_KEYS.LEDGER_ENTRIES, initialLedgerEntries),
  setLedgerEntries: (data: LedgerEntry[]) => setStorage(STORAGE_KEYS.LEDGER_ENTRIES, data),

  getOrders: (): Order[] => getStorage(STORAGE_KEYS.ORDERS, initialOrders),
  setOrders: (data: Order[]) => setStorage(STORAGE_KEYS.ORDERS, data),

  getDispatches: (): Dispatch[] => getStorage(STORAGE_KEYS.DISPATCHES, initialDispatches),
  setDispatches: (data: Dispatch[]) => setStorage(STORAGE_KEYS.DISPATCHES, data),

  getNotices: (): PlantNotice[] => getStorage(STORAGE_KEYS.NOTICES, initialNotices),
  setNotices: (data: PlantNotice[]) => setStorage(STORAGE_KEYS.NOTICES, data),

  getMachines: (): Machine[] => getStorage(STORAGE_KEYS.MACHINES, initialMachines),
  setMachines: (data: Machine[]) => setStorage(STORAGE_KEYS.MACHINES, data),

  getBreakdownTickets: (): BreakdownTicket[] => getStorage(STORAGE_KEYS.BREAKDOWNS, initialBreakdownTickets),
  setBreakdownTickets: (data: BreakdownTicket[]) => setStorage(STORAGE_KEYS.BREAKDOWNS, data),

  getWorkOrders: (): WorkOrder[] => getStorage(STORAGE_KEYS.WORK_ORDERS, initialWorkOrders),
  setWorkOrders: (data: WorkOrder[]) => setStorage(STORAGE_KEYS.WORK_ORDERS, data),

  getQcInspections: (): QcInspection[] => getStorage(STORAGE_KEYS.QC_INSPECTIONS, initialQcInspections),
  setQcInspections: (data: QcInspection[]) => setStorage(STORAGE_KEYS.QC_INSPECTIONS, data),

  resetAll: () => {
    localStorage.clear();
  },
};
