import { useEffect, useMemo, useState } from "react";
import {
  Factory,
  Gauge,
  Boxes,
  Layers3,
  ReceiptText,
  Users,
  Truck,
  BarChart3,
  Bell,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  MessageCircle,
  Clock,
  Download,
  ShieldCheck,
  TrendingUp,
  History,
  Send,
  Sparkles,
  ChevronRight,
  PackagePlus,
  RefreshCw,
  IndianRupee,
  Cpu,
  Settings,
  Trash2,
  Wrench,
  ClipboardList,
  ShieldAlert,
  ShoppingBag,
  UserCheck,
  FileText,
  WalletCards,
  Landmark,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  MoreHorizontal,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { dataService } from "./lib/dataService";
import {
  initialBoms,
  initialDispatches,
  initialInvoices,
  initialLedgerEntries,
  initialMaterials,
  initialNotices,
  initialOrders,
  initialParties,
  initialProductionEntries,
  initialProducts,
  initialStockMovements,
} from "./seed";
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
  InvoiceStatus,
  LedgerEntry,
  Machine,
  MachineStatus,
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
} from "./types";

type View =
  | "dashboard"
  | "entry"
  | "work_orders"
  | "machines"
  | "inventory"
  | "qc"
  | "dispatch"
  | "bom"
  | "billing"
  | "clients"
  | "crm"
  | "accounts"
  | "reports"
  | "notices"
  | "setup";

const rupee = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFmt = new Intl.NumberFormat("en-IN");
const today = new Date().toISOString().slice(0, 10);
const createId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const addDaysFromToday = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const viewFromPath = (path: string): View => {
  if (path.startsWith("/accounts")) return "accounts";
  if (path.startsWith("/crm")) return "crm";
  const value = path.replace(/^\//, "").split("/").filter(Boolean).join("_");
  const supported: View[] = ["dashboard", "entry", "work_orders", "machines", "inventory", "qc", "dispatch", "bom", "billing", "clients", "crm", "accounts", "reports", "notices", "setup"];
  return supported.includes(value as View) ? value as View : "dashboard";
};

import {
  calculateAgingBuckets,
  isCreditLimitExceeded,
  isDormant,
  validateGSTIN,
  validatePhone,
} from "./lib/crmUtils";

export default function App() {
  const [view, setViewState] = useState<View>(() => viewFromPath(window.location.pathname));
  const [showMoreNav, setShowMoreNav] = useState(false);
  const [userRole, setUserRole] = useState<"owner" | "supervisor" | "ca">("owner");
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [boms, setBoms] = useState<Bom[]>(initialBoms);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>(initialProductionEntries);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(initialStockMovements);
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(initialLedgerEntries);
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [dispatches, setDispatches] = useState<Dispatch[]>(initialDispatches);
  const [notices, setNotices] = useState<PlantNotice[]>(initialNotices);
  const [machines, setMachines] = useState<Machine[]>(() => dataService.getMachines());
  const [breakdownTickets, setBreakdownTickets] = useState<BreakdownTicket[]>(() => dataService.getBreakdownTickets());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => dataService.getWorkOrders());
  const [qcInspections, setQcInspections] = useState<QcInspection[]>(() => dataService.getQcInspections());

  const [toast, setToast] = useState<string>("Plant Online · Shift 1 Running");
  const setView = (nextView: View) => {
    setViewState(nextView);
    const nextPath = nextView === "dashboard" ? "/" : `/${nextView.replaceAll("_", "/")}`;
    if (window.location.pathname !== nextPath) window.history.pushState({ view: nextView }, "", nextPath);
    if (["work_orders", "machines", "qc", "bom", "reports", "notices", "setup"].includes(nextView)) setShowMoreNav(true);
  };

  useEffect(() => {
    const handlePopState = () => {
      const nextView = viewFromPath(window.location.pathname);
      setViewState(nextView);
      if (["work_orders", "machines", "qc", "bom", "reports", "notices", "setup"].includes(nextView)) setShowMoreNav(true);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast("Plant Online · Shift 1 Running"), 4000);
  };

  const activeBoms = useMemo(() => boms.filter((b) => b.isActive), [boms]);
  const todayEntries = useMemo(() => productionEntries.filter((e) => e.entryDate === today), [productionEntries]);

  // Aggregated KPI Metrics
  const totalProducedToday = todayEntries.reduce((sum, e) => sum + e.quantityProduced, 0);
  const totalRejectedToday = todayEntries.reduce((sum, e) => sum + e.quantityRejected, 0);
  const dailyTarget = products.reduce((sum, p) => sum + p.dailyTarget, 0);
  const targetProgress = dailyTarget === 0 ? 0 : Math.min(100, Math.round((totalProducedToday / dailyTarget) * 100));
  const rejectRate = totalProducedToday + totalRejectedToday === 0 ? 0 : (totalRejectedToday / (totalProducedToday + totalRejectedToday)) * 100;
  const totalDowntimeMinutes = todayEntries.reduce((sum, e) => sum + e.downtimeMinutes, 0);
  const lowStockMaterials = materials.filter((m) => m.currentStock <= m.lowStockThreshold);

  // Balances
  const partyBalances = useMemo(() => {
    return parties.map((party) => {
      const entries = ledgerEntries.filter((e) => e.partyId === party.id);
      const debit = entries.filter((e) => e.type === "debit").reduce((sum, e) => sum + e.amount, 0);
      const credit = entries.filter((e) => e.type === "credit").reduce((sum, e) => sum + e.amount, 0);
      return {
        ...party,
        debit,
        credit,
        balance: debit - credit,
      };
    });
  }, [ledgerEntries, parties]);

  const totalOutstanding = partyBalances.reduce((sum, p) => sum + Math.max(0, p.balance), 0);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue" || (i.status !== "paid" && i.dueDate < today));

  // Navigation Items
  const navItems: Array<{ id: View; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: "dashboard", label: "Plant Dashboard", icon: <Gauge size={18} /> },
    { id: "entry", label: "Shop-Floor Entry", icon: <Cpu size={18} /> },
    { id: "inventory", label: "Materials & Stock", icon: <Boxes size={18} />, badge: lowStockMaterials.length > 0 ? `${lowStockMaterials.length} Low` : undefined },
    { id: "bom", label: "BOM & Recipes", icon: <Layers3 size={18} /> },
    { id: "billing", label: "GST Invoicing", icon: <ReceiptText size={18} />, badge: overdueInvoices.length > 0 ? `${overdueInvoices.length} Due` : undefined },
    { id: "clients", label: "Clients & Parties", icon: <Users size={18} /> },
    { id: "dispatch", label: "Logistics & Dispatch", icon: <Truck size={18} /> },
    { id: "reports", label: "Production Reports", icon: <BarChart3 size={18} /> },
    { id: "notices", label: "Plant Bulletins", icon: <Bell size={18} /> },
    { id: "setup", label: "Setup & Config", icon: <Settings size={18} /> },
  ];

  // Handler: Add Production Entry with Auto Stock Deduction and Finished Goods increment
  const handleAddProduction = (form: {
    productId: string;
    quantityProduced: number;
    quantityRejected: number;
    rejectReason: string;
    shift: Shift;
    machineId: string;
    downtimeMinutes: number;
    downtimeReason: string;
  }) => {
    const product = products.find((p) => p.id === form.productId);
    const bom = activeBoms.find((b) => b.productId === form.productId);

    if (!product || !bom || form.quantityProduced <= 0) {
      showToast("Select a product with an active BOM and enter valid output.");
      return;
    }

    // Check material shortages
    const shortages = bom.lineItems
      .map((line) => {
        const mat = materials.find((m) => m.id === line.materialId);
        const req = line.qtyPerUnit * form.quantityProduced;
        return mat && mat.currentStock < req ? `${mat.name} (Need ${req.toFixed(1)} ${mat.unit}, Stock: ${mat.currentStock})` : null;
      })
      .filter(Boolean);

    if (shortages.length > 0) {
      showToast(`Stock Shortage: ${shortages.join(", ")}`);
      return;
    }

    const entryId = createId("pe");
    const createdAt = new Date().toISOString();

    const newEntry: ProductionEntry = {
      id: entryId,
      productId: product.id,
      bomId: bom.id,
      quantityProduced: form.quantityProduced,
      quantityRejected: form.quantityRejected,
      rejectReason: form.rejectReason,
      shift: form.shift,
      machineId: form.machineId,
      downtimeMinutes: form.downtimeMinutes,
      downtimeReason: form.downtimeReason,
      entryDate: today,
      enteredBy: "Ramesh Sharma (Supervisor)",
      createdAt,
    };

    // Auto-generate deduction movements
    const movements: StockMovement[] = bom.lineItems.map((line) => ({
      id: createId("sm"),
      materialId: line.materialId,
      type: "production_deduction",
      quantity: Number((line.qtyPerUnit * form.quantityProduced).toFixed(3)),
      referenceId: entryId,
      note: `Auto-deducted for ${form.quantityProduced} ${product.unit} of ${product.name}`,
      createdBy: "Production Engine",
      createdAt,
    }));

    // Update raw materials stock
    setMaterials((current) =>
      current.map((mat) => {
        const mov = movements.find((m) => m.materialId === mat.id);
        return mov ? { ...mat, currentStock: Number((mat.currentStock - mov.quantity).toFixed(3)) } : mat;
      })
    );

    // Update finished goods inventory
    setProducts((current) =>
      current.map((p) =>
        p.id === product.id ? { ...p, currentFinishedStock: p.currentFinishedStock + form.quantityProduced } : p
      )
    );

    setProductionEntries([newEntry, ...productionEntries]);
    setStockMovements([...movements, ...stockMovements]);
    showToast(`✓ Logged ${form.quantityProduced} ${product.unit} of ${product.name}. Materials deducted.`);
  };

  // Handler: Manual Stock Movement (IN / OUT)
  const handleStockMovement = (form: {
    materialId: string;
    type: "in" | "out";
    quantity: number;
    note: string;
  }) => {
    const mat = materials.find((m) => m.id === form.materialId);
    if (!mat || form.quantity <= 0) return;

    if (form.type === "out" && form.quantity > mat.currentStock) {
      showToast(`Cannot issue more than available stock (${mat.currentStock} ${mat.unit})`);
      return;
    }

    const movement: StockMovement = {
      id: createId("sm"),
      materialId: mat.id,
      type: form.type,
      quantity: form.quantity,
      note: form.note || (form.type === "in" ? "Purchase Inward" : "Shop-floor Issue"),
      createdBy: "Store Head",
      createdAt: new Date().toISOString(),
    };

    setMaterials((current) =>
      current.map((m) =>
        m.id === mat.id
          ? { ...m, currentStock: Number((m.currentStock + (form.type === "in" ? form.quantity : -form.quantity)).toFixed(3)) }
          : m
      )
    );
    setStockMovements([movement, ...stockMovements]);
    showToast(`✓ Stock ${form.type.toUpperCase()} recorded for ${mat.name}`);
  };

  // Handler: Create Invoice
  const handleCreateInvoice = (form: {
    partyId: string;
    productId: string;
    quantity: number;
    rate: number;
    gstRate: number;
    paidAmount: number;
  }) => {
    const party = parties.find((p) => p.id === form.partyId);
    const product = products.find((p) => p.id === form.productId);
    if (!party || !product || form.quantity <= 0 || form.rate <= 0) return;

    const subtotal = form.quantity * form.rate;
    const gstAmount = Math.round((subtotal * form.gstRate) / 100);
    const total = subtotal + gstAmount;
    const invoiceNumber = `INV-26-${1000 + invoices.length + 1}`;
    const invoiceId = createId("inv");
    const orderId = createId("ord");
    const dueDate = addDaysFromToday(party.creditPeriodDays);
    const createdAt = new Date().toISOString();

    const invoice: Invoice = {
      id: invoiceId,
      partyId: party.id,
      invoiceNumber,
      items: [{ productId: product.id, quantity: form.quantity, rate: form.rate, gstRate: form.gstRate }],
      subtotal,
      gstAmount,
      total,
      status: form.paidAmount >= total ? "paid" : "sent",
      dueDate,
      createdAt,
    };

    const order: Order = {
      id: orderId,
      orderNumber: `PO-${100 + orders.length + 1}`,
      partyId: party.id,
      invoiceId,
      items: [{ productId: product.id, quantity: form.quantity, rate: form.rate, gstRate: form.gstRate }],
      status: "open",
      createdAt,
    };

    const newLedger: LedgerEntry[] = [
      { id: createId("le"), partyId: party.id, invoiceId, amount: total, type: "debit", date: today, note: `GST Invoice ${invoiceNumber}` },
    ];
    if (form.paidAmount > 0) {
      newLedger.push({
        id: createId("le"),
        partyId: party.id,
        invoiceId,
        amount: Math.min(form.paidAmount, total),
        type: "credit",
        date: today,
        note: "Payment received on billing",
      });
    }

    setInvoices([invoice, ...invoices]);
    setOrders([order, ...orders]);
    setLedgerEntries([...newLedger, ...ledgerEntries]);
    showToast(`✓ Invoice ${invoiceNumber} created for ${party.name}`);
  };

  // Handler: Create Dispatch
  const handleCreateDispatch = (form: {
    orderId: string;
    transportProvider: string;
    trackingId: string;
    vehicleType: string;
    cost: number;
  }) => {
    const order = orders.find((o) => o.id === form.orderId);
    const party = parties.find((p) => p.id === order?.partyId);
    if (!order || !form.transportProvider || !form.trackingId) return;

    const dispatch: Dispatch = {
      id: createId("disp"),
      orderId: order.id,
      orderNumber: order.orderNumber,
      partyName: party?.name ?? "Client",
      transportProvider: form.transportProvider,
      trackingId: form.trackingId,
      vehicleType: form.vehicleType,
      cost: form.cost,
      status: "dispatched",
      createdAt: new Date().toISOString(),
    };

    setDispatches([dispatch, ...dispatches]);
    setOrders(orders.map((o) => (o.id === order.id ? { ...o, status: "dispatched" } : o)));
    showToast(`✓ Dispatch ${dispatch.trackingId} created for order ${order.orderNumber}`);
  };

  const handleUpdateDispatch = (dispatchId: string, status: Dispatch["status"]) => {
    const disp = dispatches.find((d) => d.id === dispatchId);
    if (!disp) return;
    setDispatches(dispatches.map((d) => (d.id === dispatchId ? { ...d, status } : d)));
    setOrders(orders.map((o) => (o.id === disp.orderId ? { ...o, status } : o)));
    showToast(`✓ Dispatch status updated to ${status.toUpperCase()}`);
  };

  // Handler: Export Production CSV
  const handleExportCsv = () => {
    const header = ["Date", "Product", "Produced Qty", "Rejected Qty", "Reject Reason", "Shift", "Machine", "Downtime (Min)", "Downtime Reason", "Supervisor"];
    const rows = productionEntries.map((e) => {
      const prod = products.find((p) => p.id === e.productId);
      return [
        e.entryDate,
        prod?.name ?? "Unknown",
        e.quantityProduced,
        e.quantityRejected,
        e.rejectReason,
        e.shift,
        e.machineId,
        e.downtimeMinutes,
        e.downtimeReason,
        e.enteredBy,
      ];
    });

    const csvContent = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FactoryOS-Production-Report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ Production CSV Report downloaded successfully.");
  };

  // Handler: Report Machine Breakdown
  const handleReportBreakdown = (data: { machineId: string; symptom: string; severity: "Urgent" | "High" | "Normal" }) => {
    dataService.reportBreakdown({ ...data, reportedBy: "Floor Supervisor" });
    setMachines(dataService.getMachines());
    setBreakdownTickets(dataService.getBreakdownTickets());
    showToast(`⚠ Breakdown reported for machine ${data.machineId}.`);
  };

  // Handler: Resolve Breakdown Ticket
  const handleResolveBreakdown = (ticketId: string) => {
    dataService.resolveBreakdown(ticketId);
    setMachines(dataService.getMachines());
    setBreakdownTickets(dataService.getBreakdownTickets());
    showToast("✓ Breakdown resolved. Machine marked back online.");
  };

  // Handler: Update Work Order Status
  const handleWorkOrderStatusChange = (id: string, status: WorkOrderStatus) => {
    dataService.updateWorkOrderStatus(id, status);
    setWorkOrders(dataService.getWorkOrders());
    showToast(`✓ Work order status updated to ${status}.`);
  };

  // Handler: Record QC Inspection
  const handleRecordQcInspection = (data: {
    batchNumber: string;
    productId: string;
    inspectedQty: number;
    passedQty: number;
    rejectedQty: number;
    defectCode: string;
    notes: string;
    inspector: string;
  }) => {
    dataService.recordQcInspection({
      batchNumber: data.batchNumber,
      productId: data.productId,
      inspectedQuantity: data.inspectedQty,
      passedQuantity: data.passedQty,
      rejectedQuantity: data.rejectedQty,
      defectCode: data.defectCode,
      notes: data.notes,
      inspector: data.inspector,
      status: data.rejectedQty > 0 ? "On Hold" : "Passed",
    });
    setQcInspections(dataService.getQcInspections());
    showToast(`✓ QC inspection recorded for batch ${data.batchNumber}.`);
  };

  return (

    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="plant-brand">
          <div className="brand-icon">
            <Factory size={24} />
          </div>
          <div className="brand-title">
            <h2>Factory OS</h2>
            <span>Enterprise Plant ERP · v3.4</span>
          </div>
        </div>

        <nav>
          <div className="nav-group-label">OPERATIONS</div>
          <button className={`nav-item ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            <Gauge size={18} />
            <span>Command Center</span>
          </button>
          <button className={`nav-item ${view === "entry" ? "active" : ""}`} onClick={() => setView("entry")}>
            <Cpu size={18} />
            <span>Production Board</span>
          </button>
          {showMoreNav && <>
            <button className={`nav-item ${view === "work_orders" ? "active" : ""}`} onClick={() => setView("work_orders")}>
              <ClipboardList size={18} />
              <span>Work Orders</span>
            </button>
            <button className={`nav-item ${view === "machines" ? "active" : ""}`} onClick={() => setView("machines")}>
              <Wrench size={18} />
              <span>Machines & Maintenance</span>
              {machines.filter((m) => m.status === "Breakdown").length > 0 && <span className="nav-badge">{machines.filter((m) => m.status === "Breakdown").length} Down</span>}
            </button>
          </>}

          <div className="nav-group-label">CONTROL</div>
          <button className={`nav-item ${view === "inventory" ? "active" : ""}`} onClick={() => setView("inventory")}>
            <Boxes size={18} />
            <span>Inventory</span>
            {lowStockMaterials.length > 0 && <span className="nav-badge">{lowStockMaterials.length} Low</span>}
          </button>
          {showMoreNav && <button className={`nav-item ${view === "qc" ? "active" : ""}`} onClick={() => setView("qc")}><ShieldAlert size={18} /><span>Quality Control</span></button>}
          <button className={`nav-item ${view === "dispatch" ? "active" : ""}`} onClick={() => setView("dispatch")}>
            <Truck size={18} />
            <span>Dispatch & Logistics</span>
          </button>
          {showMoreNav && <button className={`nav-item ${view === "bom" ? "active" : ""}`} onClick={() => setView("bom")}><Layers3 size={18} /><span>BOM & Recipes</span></button>}

          <div className="nav-group-label">ADMINISTRATION</div>
          <button className={`nav-item ${view === "clients" ? "active" : ""}`} onClick={() => setView("clients")}>
            <Users size={18} />
            <span>Client CRM & Accounts</span>
          </button>
          {userRole !== "supervisor" && <button className={`nav-item ${view === "crm" ? "active" : ""}`} onClick={() => setView("crm")}>
            <Users size={18} />
            <span>CRM</span>
          </button>}
          <button className={`nav-item ${view === "billing" ? "active" : ""}`} onClick={() => setView("billing")}>
            <ReceiptText size={18} />
            <span>GST Invoicing</span>
            {overdueInvoices.length > 0 && <span className="nav-badge">{overdueInvoices.length} Due</span>}
          </button>
          <button className={`nav-item ${view === "accounts" ? "active" : ""}`} onClick={() => setView("accounts")}>
            <WalletCards size={18} />
            <span>Accounts & Finance</span>
          </button>
          {showMoreNav && <><button className={`nav-item ${view === "reports" ? "active" : ""}`} onClick={() => setView("reports")}><BarChart3 size={18} /><span>Production Reports</span></button><button className={`nav-item ${view === "notices" ? "active" : ""}`} onClick={() => setView("notices")}><Bell size={18} /><span>Plant Bulletins</span></button></>}

          <button className="nav-more-toggle" onClick={() => setShowMoreNav((current) => !current)}><MoreHorizontal size={17} /><span>{showMoreNav ? "Show less" : "More modules"}</span><ChevronRight size={14} className={showMoreNav ? "rotated" : ""} /></button>
          {showMoreNav && <><div className="nav-group-label">SYSTEM</div><button className={`nav-item ${view === "setup" ? "active" : ""}`} onClick={() => setView("setup")}><Settings size={18} /><span>Setup & Masters</span></button></>}
        </nav>

        <div className="user-profile-widget">
          <div className="avatar-circle">RP</div>
          <div className="user-meta">
            <h4>Rajput Plastics Mfg</h4>
            <span>Plant Owner / GM</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="workspace" id="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="page-title">
              <h1>
                {view === "dashboard" && "Factory Command & Analytics Center"}
                {view === "entry" && "Shop-Floor Live Production Register"}
                {view === "work_orders" && "Work Order Pipeline & Manufacturing Jobs"}
                {view === "machines" && "Machine Status Board & Maintenance Tracker"}
                {view === "inventory" && "Raw Material & Inventory Control"}
                {view === "qc" && "Quality Control & Inspection Queue"}
                {view === "bom" && "Bill of Materials (BOM) & Product Recipes"}
                {view === "billing" && "GST Tax Invoicing & Accounts Portal"}
                {view === "clients" && "Party Directory & Ledger Balances"}
                {view === "crm" && "CRM · Sales Pipeline & Customer Growth"}
                {view === "accounts" && "Accounts & Finance Control Center"}
                {view === "dispatch" && "Logistics, Shipments & Fleet Tracker"}
                {view === "reports" && "Operational & Material Consumption Reports"}
                {view === "notices" && "Plant Bulletins & Quality Circulars"}
                {view === "setup" && "Products, Materials & BOM Setup"}
              </h1>
              <p>Plant #1 · Sitapura Industrial Area, Jaipur (RJ)</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className="form-group" style={{ margin: 0 }}>
              <select
                className="form-control"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}
                value={userRole}
                onChange={(e) => {
                  const role = e.target.value as "owner" | "supervisor" | "ca";
                  setUserRole(role);
                  showToast(`Switched active role to ${role.toUpperCase()}`);
                }}
              >
                <option value="owner">Role: Owner (Full Access)</option>
                <option value="supervisor">Role: Supervisor (No CRM Access)</option>
                <option value="ca">Role: CA / Accountant (Read-Only)</option>
              </select>
            </div>
            <div className="shift-badge">
              <Clock size={14} color="#0f766e" />
              <span>Shift: Morning (08:00 - 16:00)</span>
            </div>
            <div className="toast-badge">
              <span className="live-pulse-dot" />
              <span>{toast}</span>
            </div>
          </div>
        </header>

        {/* View Content Body */}
        <div className="view-body">
          {view === "dashboard" && (
            <DashboardView
              targetProgress={targetProgress}
              totalProduced={totalProducedToday}
              dailyTarget={dailyTarget}
              rejectRate={rejectRate}
              lowStockCount={lowStockMaterials.length}
              downtimeMinutes={totalDowntimeMinutes}
              totalOutstanding={totalOutstanding}
              products={products}
              entries={todayEntries}
              invoices={invoices}
              dispatches={dispatches}
              notices={notices}
              machines={machines}
              workOrders={workOrders}
              qcInspections={qcInspections}
              setView={setView}
            />
          )}

          {view === "entry" && (
            <ProductionEntryView
              products={products}
              activeBoms={activeBoms}
              materials={materials}
              todayEntries={todayEntries}
              onAddEntry={handleAddProduction}
            />
          )}

          {view === "inventory" && (
            <InventoryView
              materials={materials}
              stockMovements={stockMovements}
              onAddMovement={handleStockMovement}
            />
          )}

          {view === "work_orders" && (
            <WorkOrdersView
              workOrders={workOrders}
              products={products}
              machines={machines}
              userRole={userRole}
              onStatusChange={handleWorkOrderStatusChange}
              showToast={showToast}
            />
          )}

          {view === "machines" && (
            <MachinesView
              machines={machines}
              breakdownTickets={breakdownTickets}
              onReportBreakdown={handleReportBreakdown}
              onResolveBreakdown={handleResolveBreakdown}
              showToast={showToast}
            />
          )}

          {view === "qc" && (
            <QualityControlView
              qcInspections={qcInspections}
              products={products}
              onRecordInspection={handleRecordQcInspection}
              showToast={showToast}
            />
          )}

          {view === "bom" && (
            <BomView
              products={products}
              boms={boms}
              materials={materials}
            />
          )}

          {view === "billing" && (
            <BillingView
              invoices={invoices}
              parties={parties}
              products={products}
              totalOutstanding={totalOutstanding}
              overdueCount={overdueInvoices.length}
              onCreateInvoice={handleCreateInvoice}
            />
          )}

          {view === "clients" && (
            <ClientsCrmView
              parties={parties}
              partyBalances={partyBalances}
              ledgerEntries={ledgerEntries}
              invoices={invoices}
              userRole={userRole}
              onClientCreated={(newClient) => setParties(dataService.getParties())}
              setView={setView}
              showToast={showToast}
            />
          )}

          {view === "crm" && (
            <CrmFoundationView parties={parties} invoices={invoices} userRole={userRole} showToast={showToast} onNavigate={setView} />
          )}

          {view === "accounts" && (
            <AccountsFinanceView
              invoices={invoices}
              parties={parties}
              ledgerEntries={ledgerEntries}
              materials={materials}
              products={products}
              productionEntries={productionEntries}
              machines={machines}
              userRole={userRole}
              onNavigate={setView}
              showToast={showToast}
            />
          )}

          {view === "dispatch" && (
            <DispatchView
              dispatches={dispatches}
              orders={orders}
              parties={parties}
              onCreateDispatch={handleCreateDispatch}
              onUpdateStatus={handleUpdateDispatch}
            />
          )}

          {view === "reports" && (
            <ReportsView
              entries={productionEntries}
              products={products}
              materials={materials}
              boms={boms}
              onExport={handleExportCsv}
            />
          )}

          {view === "notices" && (
            <NoticesView
              notices={notices}
              onAddNotice={(n) => {
                setNotices([n, ...notices]);
                showToast("✓ New Plant Bulletin Broadcasted.");
              }}
            />
          )}

          {view === "setup" && (
            <SetupView
              products={products}
              materials={materials}
              boms={boms}
              onProductCreated={(p) => setProducts(dataService.getProducts())}
              onMaterialCreated={(m) => {
                setMaterials(dataService.getMaterials());
                setStockMovements(dataService.getStockMovements());
              }}
              onBomSaved={(b) => setBoms(dataService.getBoms())}
              showToast={showToast}
            />
          )}
        </div>
      </main>
    </div>
  );
}

type CrmLead = { id: string; company: string; city: string; source: string; product: string; value: number; stage: string; temperature: string; owner: string };

function CrmFoundationView({ parties, invoices, userRole, showToast, onNavigate }: { parties: Party[]; invoices: Invoice[]; userRole: "owner" | "supervisor" | "ca"; showToast: (message: string) => void; onNavigate: (view: View) => void }) {
  const crmTabFromPath = window.location.pathname.split("/")[2] || "dashboard";
  const [tab, setTabState] = useState(crmTabFromPath === "follow-ups" ? "followups" : crmTabFromPath);
  const setTab = (nextTab: string) => {
    setTabState(nextTab);
    const pathSegment = nextTab === "followups" ? "follow-ups" : nextTab;
    window.history.pushState({ tab: nextTab }, "", `/crm/${pathSegment}`);
  };
  useEffect(() => {
    const handleCrmPopState = () => {
      const pathTab = window.location.pathname.split("/")[2] || "dashboard";
      setTabState(pathTab === "follow-ups" ? "followups" : pathTab);
    };
    window.addEventListener("popstate", handleCrmPopState);
    return () => window.removeEventListener("popstate", handleCrmPopState);
  }, []);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLead(null);
        setShowLeadForm(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);
  const [query, setQuery] = useState("");
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadDraft, setLeadDraft] = useState({ company: "", city: "", product: "", value: "", source: "Referral" });
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>(() => {
    try {
      const saved = window.localStorage.getItem("factory-os-crm-leads");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
    { id: "LD-2601", company: "Marwar Plastic Agencies", city: "Kota", source: "Referral", product: "20L Storage Crate", value: 85000, stage: "Qualified", temperature: "Hot", owner: "Ayush" },
    { id: "LD-2602", company: "Khandelwal Retail Network", city: "Jaipur", source: "IndiaMART", product: "Pedal Dustbin", value: 132000, stage: "Quotation Sent", temperature: "Warm", owner: "Ayush" },
    { id: "LD-2603", company: "Shree Om Distributors", city: "Ajmer", source: "Walk-in", product: "Sorting Tray", value: 64000, stage: "Contacted", temperature: "Cold", owner: "Ravi" },
    ];
  });
  useEffect(() => {
    window.localStorage.setItem("factory-os-crm-leads", JSON.stringify(leads));
  }, [leads]);
  const tabs = [["dashboard", "Dashboard"], ["leads", "Leads"], ["pipeline", "Pipeline"], ["customers", "Customers"], ["quotations", "Quotations"], ["followups", "Follow-ups"], ["activities", "Activities"], ["complaints", "Complaints"], ["reports", "Reports"], ["settings", "Settings"]];
  const openPipeline = leads.reduce((sum, lead) => sum + lead.value, 0);
  const won = parties.filter((party) => party.status === "active").length;
  const filteredLeads = leads.filter((lead) => `${lead.company} ${lead.city} ${lead.source}`.toLowerCase().includes(query.toLowerCase()) && (ownerFilter === "all" || lead.owner === ownerFilter) && (sourceFilter === "all" || lead.source === sourceFilter));
  const customerList = parties.filter((party) => party.type === "Customer");
  const crmTabs = tabs.filter(([value]) => userRole !== "ca" || ["dashboard", "customers", "quotations", "reports"].includes(value));
  return <div className="crm-module">
    <div className="crm-header"><div><div className="eyebrow">SALES WORKSPACE · PIPELINE CONTROL</div><h2>CRM</h2><p>Leads, quotations, follow-ups, customers and sales pipeline.</p></div><div className="accounts-header-actions"><span className="finance-role"><ShieldCheck size={15} /> {userRole === "owner" ? "Owner access" : "Read-only view"}</span><button className="btn-primary" onClick={() => setShowLeadForm(true)}><Plus size={16} /> Add lead</button></div></div>
    <div className="accounts-tabs crm-tabs" role="tablist" aria-label="CRM sections">{crmTabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}</div>
    <div className="crm-toolbar"><div className="finance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search leads, customers or city" /></div><select className="form-control" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option value="all">All owners</option><option value="Ayush">Ayush</option><option value="Ravi">Ravi</option></select><select className="form-control" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">All sources</option><option value="IndiaMART">IndiaMART</option><option value="Referral">Referral</option><option value="Walk-in">Walk-in</option></select><button className="btn-outline" onClick={() => showToast("CRM export prepared")}><Download size={14} /> Export</button></div>
    {tab === "dashboard" && <><div className="finance-kpi-grid crm-kpis"><FinanceKpi label="New leads" value="12" detail="This month · ↑ 20%" tone="blue" icon={<Users size={18} />} /><FinanceKpi label="Open pipeline value" value={rupee.format(openPipeline)} detail="7 active opportunities" tone="purple" icon={<TrendingUp size={18} />} /><FinanceKpi label="Quotations sent" value="8" detail={rupee.format(326000)} tone="orange" icon={<ReceiptText size={18} />} /><FinanceKpi label="Won this month" value={`${won}`} detail={rupee.format(196000)} tone="green" icon={<CheckCircle size={18} />} /><FinanceKpi label="Conversion rate" value="24%" detail="Lead to won" tone="teal" icon={<ArrowUpRight size={18} />} /><FinanceKpi label="Follow-ups overdue" value="3" detail="Needs action today" tone="red" icon={<Clock size={18} />} /></div><div className="crm-dashboard-grid"><section className="panel"><div className="panel-header"><div className="panel-title"><h3>Sales funnel</h3><p>Open opportunities by stage</p></div><button className="btn-outline btn-sm" onClick={() => setTab("pipeline")}>Open pipeline</button></div><div className="crm-funnel">{[["New", 8, 380000], ["Contacted", 6, 294000], ["Qualified", 4, 217000], ["Quotation", 3, 167000], ["Negotiation", 2, 112000], ["Won", 1, 56000]].map(([stage, count, value], index) => <div key={String(stage)}><div><span>{stage}</span><strong>{count} <small>{rupee.format(Number(value))}</small></strong></div><div className="ageing-track"><span style={{ width: `${92 - index * 12}%`, background: index > 4 ? "var(--status-green)" : "var(--status-blue)" }} /></div></div>)}</div></section><section className="panel"><div className="panel-header"><div className="panel-title"><h3>Today's follow-ups</h3><p>Calls, WhatsApp and payment reminders</p></div><span className="badge badge-danger">3 overdue</span></div><div className="crm-followups"><div><span className="status-dot red" /><strong>Arihant Industrial Supplies</strong><small>Payment reminder · 10:30 AM</small><button className="btn-outline btn-sm" onClick={() => showToast("Follow-up marked complete")}>Done</button></div><div><span className="status-dot orange" /><strong>Khandelwal Retail Network</strong><small>Quotation follow-up · 2:00 PM</small><button className="btn-outline btn-sm" onClick={() => showToast("Follow-up rescheduled")}>Reschedule</button></div><div><span className="status-dot blue" /><strong>Marwar Plastic Agencies</strong><small>Send product catalogue · 4:30 PM</small><button className="btn-outline btn-sm" onClick={() => showToast("WhatsApp template ready")}>WhatsApp</button></div></div></section></div></>}
    {tab === "leads" || tab === "pipeline" ? <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>{tab === "leads" ? "Lead directory" : "Sales pipeline"}</h3><p>Lead to quotation and work-order handoff control</p></div><button className="btn-primary" onClick={() => showToast("Lead form ready")}><Plus size={16} /> Add lead</button></div>{tab === "pipeline" ? <div className="crm-kanban">{["New", "Contacted", "Qualified", "Quotation Sent", "Negotiation", "Won"].map((stage) => <div className="crm-column" key={stage}><div className="crm-column-header"><strong>{stage}</strong><span>{filteredLeads.filter((lead) => lead.stage === stage).length}</span></div>{filteredLeads.filter((lead) => lead.stage === stage).map((lead) => <button className="crm-deal-card" key={lead.id} onClick={() => setSelectedLead(lead)}><strong>{lead.company}</strong><small>{lead.product}</small><b>{rupee.format(lead.value)}</b><span className={`badge badge-${lead.temperature === "Hot" ? "danger" : lead.temperature === "Warm" ? "warning" : "info"}`}>{lead.temperature}</span></button>)}</div>)}</div> : <div className="table-container"><table><thead><tr><th>Lead ID</th><th>Company / contact</th><th>City</th><th>Source</th><th>Product interest</th><th>Expected value</th><th>Stage</th><th>Owner</th></tr></thead><tbody>{filteredLeads.map((lead) => <tr key={lead.id} onClick={() => setSelectedLead(lead)}><td><strong>{lead.id}</strong></td><td>{lead.company}</td><td>{lead.city}</td><td>{lead.source}</td><td>{lead.product}</td><td>{rupee.format(lead.value)}</td><td><span className="badge badge-blue">{lead.stage}</span></td><td>{lead.owner}</td></tr>)}</tbody></table></div>}</section> : tab === "customers" ? <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>Customer 360 directory</h3><p>Shared customer records from Accounts and CRM</p></div><button className="btn-outline" onClick={() => onNavigate("clients")}>Open Accounts customers</button></div><div className="table-container"><table><thead><tr><th>Customer</th><th>City</th><th>GSTIN</th><th>Customer type</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{customerList.map((party) => <tr key={party.id}><td><strong>{party.name}</strong><small className="table-sub">{party.phone}</small></td><td>{party.city}</td><td>{party.gstin}</td><td>{party.clientCategory ?? "Dealer"}</td><td>{rupee.format(ledgerEntriesForParty(party.id, invoices))}</td><td><span className="badge badge-success">{party.status ?? "active"}</span></td></tr>)}</tbody></table></div></section> : <section className="panel crm-placeholder"><Sparkles size={22} /><h3>{tabs.find(([value]) => value === tab)?.[1] ?? "CRM"}</h3><p>This workspace is ready for the next CRM phase: detailed records, drawer view, approvals and source-linked actions.</p><button className="btn-primary" onClick={() => showToast("CRM workspace ready for configuration")}><Plus size={16} /> Create first record</button></section>}
    {selectedLead && <><button className="drawer-scrim" aria-label="Close lead details" onClick={() => setSelectedLead(null)} /><aside className="detail-drawer" aria-label="Lead details"><div className="detail-drawer-header"><div><span className="eyebrow">LEAD DETAILS</span><h3>{selectedLead.company}</h3><p>{selectedLead.id} · {selectedLead.city}</p></div><button className="icon-button" aria-label="Close lead details" onClick={() => setSelectedLead(null)}><X size={18} /></button></div><div className="detail-drawer-body"><div className="drawer-status-row"><span className="badge badge-blue">{selectedLead.stage}</span><span className={`badge badge-${selectedLead.temperature === "Hot" ? "danger" : selectedLead.temperature === "Warm" ? "warning" : "info"}`}>{selectedLead.temperature} lead</span></div><div className="drawer-value"><span>Expected value</span><strong>{rupee.format(selectedLead.value)}</strong></div><div className="drawer-detail-list"><div><span>Product interest</span><strong>{selectedLead.product}</strong></div><div><span>Source</span><strong>{selectedLead.source}</strong></div><div><span>Owner</span><strong>{selectedLead.owner}</strong></div></div><div className="drawer-section"><h4>Next best action</h4><p>Follow up with the customer, confirm requirements, and move this lead toward a quotation.</p><button className="btn-primary" onClick={() => showToast("Follow-up action ready")}><MessageCircle size={16} /> Start follow-up</button></div></div></aside></>}
    {showLeadForm && <><button className="drawer-scrim" aria-label="Close add lead form" onClick={() => setShowLeadForm(false)} /><section className="lead-form-modal" role="dialog" aria-modal="true" aria-labelledby="lead-form-title"><div className="detail-drawer-header"><div><span className="eyebrow">NEW OPPORTUNITY</span><h3 id="lead-form-title">Add lead</h3><p>Create a lead and track it from first contact.</p></div><button className="icon-button" aria-label="Close add lead form" onClick={() => setShowLeadForm(false)}><X size={18} /></button></div><form className="lead-form-body" onSubmit={(event) => { event.preventDefault(); const nextLead = { id: `LD-${2604 + leads.length}`, company: leadDraft.company, city: leadDraft.city, source: leadDraft.source, product: leadDraft.product, value: Number(leadDraft.value), stage: "New", temperature: "Warm", owner: "Ayush" }; setLeads((current) => [...current, nextLead]); setLeadDraft({ company: "", city: "", product: "", value: "", source: "Referral" }); setShowLeadForm(false); showToast("Lead added to the pipeline"); }}><label>Company<input required className="form-control" value={leadDraft.company} onChange={(event) => setLeadDraft({ ...leadDraft, company: event.target.value })} placeholder="e.g. Rajasthan Traders" /></label><div className="form-two-col"><label>City<input required className="form-control" value={leadDraft.city} onChange={(event) => setLeadDraft({ ...leadDraft, city: event.target.value })} placeholder="Jaipur" /></label><label>Expected value<input required type="number" min="0" className="form-control" value={leadDraft.value} onChange={(event) => setLeadDraft({ ...leadDraft, value: event.target.value })} placeholder="50000" /></label></div><label>Product interest<input required className="form-control" value={leadDraft.product} onChange={(event) => setLeadDraft({ ...leadDraft, product: event.target.value })} placeholder="20L Storage Crate" /></label><label>Source<select className="form-control" value={leadDraft.source} onChange={(event) => setLeadDraft({ ...leadDraft, source: event.target.value })}><option>Referral</option><option>IndiaMART</option><option>Walk-in</option></select></label><div className="modal-actions"><button type="button" className="btn-outline" onClick={() => setShowLeadForm(false)}>Cancel</button><button className="btn-primary" type="submit"><Plus size={16} /> Create lead</button></div></form></section></>}
  </div>;
}

function ledgerEntriesForParty(partyId: string, invoices: Invoice[]): number {
  return invoices.filter((invoice) => invoice.partyId === partyId && invoice.status !== "paid").reduce((sum, invoice) => sum + invoice.total, 0);
}

/* =========================================================================
   ACCOUNTS & FINANCE CONTROL CENTER
========================================================================= */
function AccountsFinanceView({
  invoices,
  parties,
  ledgerEntries,
  materials,
  products,
  productionEntries,
  machines,
  userRole,
  onNavigate,
  showToast,
}: {
  invoices: Invoice[];
  parties: Party[];
  ledgerEntries: LedgerEntry[];
  materials: Material[];
  products: Product[];
  productionEntries: ProductionEntry[];
  machines: Machine[];
  userRole: "owner" | "supervisor" | "ca";
  onNavigate: (view: View) => void;
  showToast: (message: string) => void;
}) {
  const accountsSectionFromPath = window.location.pathname.split("/")[2] || "dashboard";
  const [section, setSectionState] = useState(accountsSectionFromPath);
  const setSection = (nextSection: string) => {
    setSectionState(nextSection);
    window.history.pushState({ section: nextSection }, "", `/accounts/${nextSection}`);
  };
  useEffect(() => {
    const handleAccountsPopState = () => setSectionState(window.location.pathname.split("/")[2] || "dashboard");
    window.addEventListener("popstate", handleAccountsPopState);
    return () => window.removeEventListener("popstate", handleAccountsPopState);
  }, []);
  const [query, setQuery] = useState("");
  const receivables = parties
    .filter((party) => party.type === "Customer")
    .map((party) => ({
      party,
      balance: ledgerEntries.filter((entry) => entry.partyId === party.id).reduce((total, entry) => total + (entry.type === "debit" ? entry.amount : -entry.amount), 0),
    }))
    .filter((item) => item.balance > 0);
  const totalReceivables = receivables.reduce((total, item) => total + item.balance, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "overdue").reduce((total, invoice) => total + invoice.total, 0);
  const totalRevenue = invoices.filter((invoice) => invoice.status === "paid" || invoice.status === "sent").reduce((total, invoice) => total + invoice.total, 0);
  const productionCost = productionEntries.reduce((total, entry) => total + entry.quantityProduced * 18, 0);
  const payableEstimate = materials.reduce((total, material) => total + Math.max(0, material.lowStockThreshold - material.currentStock) * material.unitCost, 0) + 185000;
  const filteredInvoices = invoices.filter((invoice) => {
    const party = parties.find((item) => item.id === invoice.partyId);
    return `${invoice.invoiceNumber} ${party?.name ?? ""}`.toLowerCase().includes(query.toLowerCase());
  });
  const tabs = [
    ["dashboard", "Accounts Dashboard"],
    ["receivables", "Sales & Receivables"],
    ["payables", "Purchase & Payables"],
    ["expenses", "Expenses"],
    ["cash", "Cash & Bank"],
    ["costing", "Production Costing"],
    ["payroll", "Payroll Payables"],
    ["ledger", "Ledger"],
    ["tax", "GST & Tax"],
    ["reports", "Financial Reports"],
    ["settings", "Account Settings"],
  ];
  const runAction = (message: string) => showToast(`${message} workspace ready`);

  return (
    <div className="accounts-module">
      <div className="accounts-header">
        <div>
          <div className="eyebrow">FINANCE CONTROL CENTER · FY 2026–27</div>
          <h2>Accounts & Finance</h2>
          <p>Receivables, payables, cash control and factory profitability in one place.</p>
        </div>
        <div className="accounts-header-actions">
          <span className="finance-role"><ShieldCheck size={15} /> {userRole === "owner" ? "Owner access" : userRole === "ca" ? "Read-only CA" : "Supervisor view"}</span>
          <button className="btn-primary" onClick={() => runAction("Journal entry")}><Plus size={16} /> New journal entry</button>
        </div>
      </div>

      <div className="accounts-tabs" role="tablist">
        {tabs.map(([value, label]) => (
          <button key={value} className={section === value ? "active" : ""} onClick={() => setSection(value)}>{label}</button>
        ))}
      </div>

      {section === "dashboard" && (
        <>
          <div className="finance-kpi-grid">
            <FinanceKpi label="Total receivables" value={rupee.format(totalReceivables)} detail={`${rupee.format(overdue)} overdue`} tone="blue" icon={<ArrowUpRight size={19} />} />
            <FinanceKpi label="Total payables" value={rupee.format(payableEstimate)} detail="3 bills due this week" tone="orange" icon={<ArrowDownRight size={19} />} />
            <FinanceKpi label="Cash & bank balance" value={rupee.format(864500)} detail="Updated 10 minutes ago" tone="green" icon={<Landmark size={19} />} />
            <FinanceKpi label="This month revenue" value={rupee.format(totalRevenue)} detail="↑ 12.4% vs last month" tone="purple" icon={<TrendingUp size={19} />} />
            <FinanceKpi label="This month expense" value={rupee.format(productionCost + 126000)} detail="Materials · payroll · freight" tone="red" icon={<ReceiptText size={19} />} />
            <FinanceKpi label="Net profit estimate" value={rupee.format(Math.max(0, totalRevenue - productionCost - 126000))} detail="Revenue minus direct costs" tone="teal" icon={<IndianRupee size={19} />} />
          </div>

          <div className="finance-layout-main">
            <section className="panel finance-chart-panel">
              <div className="panel-header"><div className="panel-title"><h3>Receivables ageing</h3><p>Outstanding customer balances by payment age</p></div><button className="btn-outline btn-sm" onClick={() => setSection("receivables")}><Filter size={14} /> View report</button></div>
              <div className="ageing-list">
                {[['Current', 46, 'var(--status-green)'], ['1–30 days', 28, 'var(--status-blue)'], ['31–60 days', 16, 'var(--status-orange)'], ['60+ days', 10, 'var(--status-red)']].map(([label, percent, color]) => (
                  <div className="ageing-row" key={String(label)}><div><span>{label}</span><strong>{rupee.format(totalReceivables * Number(percent) / 100)}</strong></div><div className="ageing-track"><span style={{ width: `${percent}%`, background: color }} /></div></div>
                ))}
              </div>
            </section>
            <section className="panel finance-chart-panel">
              <div className="panel-header"><div className="panel-title"><h3>Monthly cash flow</h3><p>Receipts vs payments · last 6 months</p></div><span className="badge badge-blue">Live ledger</span></div>
              <div className="cash-bars">{[52, 64, 44, 72, 58, 86].map((height, index) => <div className="cash-bar-column" key={index}><div className="cash-bar" style={{ height: `${height}%` }} /><span>{['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][index]}</span></div>)}</div>
            </section>
          </div>

          <div className="finance-layout-three">
            <section className="panel"><div className="panel-header"><div className="panel-title"><h3>Quick finance actions</h3><p>Common accounting workflows</p></div></div><div className="finance-actions">{[["Create sales invoice", <ReceiptText size={17} />, "billing"], ["Record payment received", <IndianRupee size={17} />, "receivables"], ["Add expense", <FileText size={17} />, "expenses"], ["Transfer cash to bank", <Landmark size={17} />, "cash"], ["Export financial summary", <FileSpreadsheet size={17} />, "reports"]].map(([label, icon, target]) => <button key={String(label)} onClick={() => target === "billing" ? onNavigate("billing") : setSection(String(target))}><span className="action-icon">{icon}</span>{label}</button>)}</div></section>
            <section className="panel"><div className="panel-header"><div className="panel-title"><h3>Pending approvals</h3><p>Finance actions needing attention</p></div><span className="badge badge-warning">4 pending</span></div><div className="approval-list"><div><span className="status-dot orange" />Purchase bill <strong>PB-1048</strong><small>₹48,600 · Raw material</small></div><div><span className="status-dot orange" />Expense claim <strong>EXP-238</strong><small>₹12,400 · Maintenance</small></div><div><span className="status-dot blue" />Bank reconciliation <strong>HDFC · Sep</strong><small>₹2,850 difference</small></div></div></section>
            <section className="panel"><div className="panel-header"><div className="panel-title"><h3>Top outstanding</h3><p>Customers to follow up today</p></div><button className="btn-outline btn-sm" onClick={() => onNavigate("clients")}>Open CRM</button></div><div className="outstanding-list">{receivables.slice(0, 5).map(({ party, balance }) => <div key={party.id}><span className="mini-avatar">{party.name.slice(0, 2).toUpperCase()}</span><span>{party.name}<small>{party.city}</small></span><strong>{rupee.format(balance)}</strong></div>)}</div></section>
          </div>
        </>
      )}

      {section === "receivables" && <FinanceTable title="Sales & Receivables" subtitle="Invoices, payments received and customer ageing" invoices={filteredInvoices} parties={parties} query={query} setQuery={setQuery} onCreate={() => onNavigate("billing")} />}
      {section === "payables" && <FinanceListSection title="Purchase & Payables" subtitle="Vendor bills, due dates and payment commitments" icon={<ShoppingBag size={20} />} rows={[["PB-1048", "Shree Polymers & Chemicals", "Raw material purchase", "₹48,600", "Due in 4 days", "Pending"], ["PB-1042", "Jaipur Power Corporation", "Electricity · September", "₹32,850", "Due in 8 days", "Approved"], ["PB-1039", "Porter Express Logistics", "Dispatch freight", "₹18,400", "Paid", "Paid"]]} onCreate={() => runAction("Purchase bill")} />}
      {section === "expenses" && <FinanceListSection title="Expense Management" subtitle="Track, approve and control every factory expense" icon={<ReceiptText size={20} />} rows={[["EXP-238", "Machine Maintenance", "Hydraulic oil & service", "₹12,400", "Today", "Pending Approval"], ["EXP-237", "Transport", "Local dispatch freight", "₹8,200", "Yesterday", "Approved"], ["EXP-236", "Packaging", "Cartons and labels", "₹18,650", "30 Sep", "Paid"]]} onCreate={() => runAction("Expense")} />}
      {section === "cash" && <CashBankSection showToast={showToast} />}
      {section === "costing" && <CostingSection products={products} productionEntries={productionEntries} machines={machines} />}
      {section === "payroll" && <FinanceListSection title="Payroll Payables" subtitle="Liability view from approved HR payroll" icon={<Users size={20} />} rows={[["SEP-2026", "Production team", "Net salary", "₹2,84,500", "10 Oct", "Pending"], ["SEP-2026", "PF / ESI", "Statutory liability", "₹48,200", "15 Oct", "Pending"], ["AUG-2026", "All departments", "Salary payout", "₹3,12,800", "10 Sep", "Paid"]]} onCreate={() => runAction("Payroll payment")} />}
      {section === "ledger" && <LedgerSection ledgerEntries={ledgerEntries} parties={parties} />}
      {section === "tax" && <TaxSection invoices={invoices} />}
      {section === "reports" && <ReportsFinanceSection onExport={() => showToast("Financial report exported")} />}
      {section === "settings" && <FinanceSettingsSection />}
    </div>
  );
}

function FinanceKpi({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: string; icon: React.ReactNode }) {
  return <div className="finance-kpi"><div className={`finance-kpi-icon ${tone}`}>{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function FinanceTable({ title, subtitle, invoices, parties, query, setQuery, onCreate }: { title: string; subtitle: string; invoices: Invoice[]; parties: Party[]; query: string; setQuery: (value: string) => void; onCreate: () => void }) {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>{title}</h3><p>{subtitle}</p></div><button className="btn-primary" onClick={onCreate}><Plus size={16} /> Create sales invoice</button></div><div className="finance-toolbar"><div className="finance-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice, customer or amount" /></div><button className="btn-outline"><Filter size={14} /> Filters</button><button className="btn-outline"><Download size={14} /> Export</button></div><div className="table-container"><table><thead><tr><th>Invoice</th><th>Customer</th><th>Created</th><th>Amount</th><th>Due date</th><th>Status</th><th>Action</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small className="table-sub">{invoice.items.length} line items</small></td><td>{parties.find((party) => party.id === invoice.partyId)?.name ?? "Unknown party"}</td><td>{invoice.createdAt}</td><td><strong>{rupee.format(invoice.total)}</strong><small className="table-sub">Balance due</small></td><td>{invoice.dueDate}</td><td><span className={`badge badge-${invoice.status === "overdue" ? "danger" : invoice.status === "paid" ? "success" : "info"}`}>{invoice.status}</span></td><td><button className="icon-button"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div></section>;
}

function FinanceListSection({ title, subtitle, icon, rows, onCreate }: { title: string; subtitle: string; icon: React.ReactNode; rows: string[][]; onCreate: () => void }) {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title with-icon"><span className="section-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div><button className="btn-primary" onClick={onCreate}><Plus size={16} /> Add new</button></div><div className="table-container"><table><thead><tr><th>Reference</th><th>Party / Department</th><th>Description</th><th>Amount</th><th>Due / date</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`}>{index === 5 ? <span className={`badge badge-${cell === "Paid" || cell === "Approved" ? "success" : cell === "Pending Approval" || cell === "Pending" ? "warning" : "info"}`}>{cell}</span> : cell}</td>)}<td><button className="icon-button"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table></div></section>;
}

function CashBankSection({ showToast }: { showToast: (message: string) => void }) {
  return <div className="finance-cash-grid"><div className="finance-balance-card dark"><div><span>Available cash & bank</span><strong>{rupee.format(864500)}</strong><small>All accounts · reconciled 96%</small></div><Landmark size={30} /></div><div className="finance-balance-card"><span>Cash in hand</span><strong>{rupee.format(84500)}</strong><small>Petty cash · updated today</small><button className="btn-outline btn-sm" onClick={() => showToast("Cash transaction form")}>Add transaction</button></div><div className="finance-balance-card"><span>HDFC Bank · Current</span><strong>{rupee.format(780000)}</strong><small>A/c •••• 4582 · IFSC HDFC000123</small><button className="btn-outline btn-sm" onClick={() => showToast("Bank reconciliation opened")}>Reconcile</button></div><section className="panel wide"><div className="panel-header"><div className="panel-title"><h3>Recent cash and bank transactions</h3><p>Double-entry posting with source references</p></div><button className="btn-primary" onClick={() => showToast("Transfer form ready")}><ArrowUpRight size={16} /> Transfer funds</button></div><FinanceListSection title="" subtitle="" icon={<Landmark size={18} />} rows={[["TRF-982", "Cash → HDFC Bank", "Daily deposit", "₹35,000", "Today", "Posted"], ["RCPT-441", "Jaipur Mega Mart", "Payment received", "₹68,500", "Today", "Posted"], ["PAY-208", "Shree Polymers", "Vendor payment", "₹42,800", "Yesterday", "Posted"]]} onCreate={() => showToast("Transaction form")} /></section></div>;
}

function CostingSection({ products, productionEntries, machines }: { products: Product[]; productionEntries: ProductionEntry[]; machines: Machine[] }) {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>Production Costing</h3><p>Actual factory cost by work order and finished product</p></div><span className="badge badge-blue">Live from shop floor</span></div><div className="finance-kpi-grid compact"><FinanceKpi label="Direct material cost" value={rupee.format(248600)} detail="Issued inventory rate" tone="blue" icon={<Boxes size={18} />} /><FinanceKpi label="Labour cost" value={rupee.format(86400)} detail="Approved hours" tone="purple" icon={<Users size={18} />} /><FinanceKpi label="Machine runtime" value={rupee.format(52800)} detail={`${machines.length} machines configured`} tone="orange" icon={<Wrench size={18} />} /><FinanceKpi label="Cost per unit" value={rupee.format(18)} detail="Accepted finished goods" tone="green" icon={<IndianRupee size={18} />} /></div><div className="table-container"><table><thead><tr><th>Product</th><th>Planned qty</th><th>Produced</th><th>Rejected</th><th>Total cost</th><th>Cost / unit</th><th>Variance</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.id}><td><strong>{product.name}</strong><small className="table-sub">{product.code}</small></td><td>{product.dailyTarget}</td><td>{productionEntries[index]?.quantityProduced ?? 0}</td><td>{productionEntries[index]?.quantityRejected ?? 0}</td><td>{rupee.format((productionEntries[index]?.quantityProduced ?? 0) * 18)}</td><td>{rupee.format(18)}</td><td><span className="badge badge-success">On plan</span></td></tr>)}</tbody></table></div></section>;
}

function LedgerSection({ ledgerEntries, parties }: { ledgerEntries: LedgerEntry[]; parties: Party[] }) {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>General Ledger</h3><p>Immutable double-entry transaction register</p></div><button className="btn-primary"><Plus size={16} /> Journal entry</button></div><div className="ledger-summary"><span>Chart of accounts <strong>28 accounts</strong></span><span>Period debits <strong>{rupee.format(ledgerEntries.filter((entry) => entry.type === "debit").reduce((sum, entry) => sum + entry.amount, 0))}</strong></span><span>Period credits <strong>{rupee.format(ledgerEntries.filter((entry) => entry.type === "credit").reduce((sum, entry) => sum + entry.amount, 0))}</strong></span></div><div className="table-container"><table><thead><tr><th>Date</th><th>Party / account</th><th>Source</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>{ledgerEntries.map((entry) => <tr key={entry.id}><td>{entry.date}</td><td>{parties.find((party) => party.id === entry.partyId)?.name ?? "Accounts receivable"}</td><td>{entry.note}</td><td>{entry.type === "debit" ? rupee.format(entry.amount) : "—"}</td><td>{entry.type === "credit" ? rupee.format(entry.amount) : "—"}</td><td><strong>{rupee.format(entry.amount)}</strong></td></tr>)}</tbody></table></div></section>;
}

function TaxSection({ invoices }: { invoices: Invoice[] }) {
  const output = invoices.reduce((sum, invoice) => sum + invoice.gstAmount, 0);
  return <div className="tax-grid"><FinanceKpi label="Output GST" value={rupee.format(output)} detail="GST collected on sales" tone="blue" icon={<ReceiptText size={18} />} /><FinanceKpi label="Input GST" value={rupee.format(28400)} detail="Eligible ITC from purchases" tone="green" icon={<ArrowDownRight size={18} />} /><FinanceKpi label="Net GST payable" value={rupee.format(Math.max(0, output - 28400))} detail="Filing period · October 2026" tone="orange" icon={<IndianRupee size={18} />} /><section className="panel wide"><div className="panel-header"><div className="panel-title"><h3>GST compliance workspace</h3><p>Sales register, purchase register, HSN summary and tax liabilities</p></div><span className="badge badge-warning">Filing in 12 days</span></div><div className="tax-checklist">{["Sales register reconciled", "Input tax credit matched", "HSN summary reviewed", "GSTR-1 preparation"].map((item, index) => <div key={item}><span className={`check ${index < 2 ? "done" : ""}`}>{index < 2 ? "✓" : "•"}</span><span>{item}</span><small>{index < 2 ? "Complete" : "Action required"}</small></div>)}</div></section></div>;
}

function ReportsFinanceSection({ onExport }: { onExport: () => void }) {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>Financial Reports</h3><p>Export-ready reports with date range and plant filters</p></div><button className="btn-primary" onClick={onExport}><Download size={16} /> Export summary</button></div><div className="report-grid">{["Profit & Loss", "Balance Sheet", "Cash Flow Statement", "Trial Balance", "Receivable Aging", "Payable Aging", "Product Profitability", "GST Summary"].map((report) => <button key={report} onClick={onExport}><FileText size={19} /><span>{report}<small>FY 2026–27 · Plant #1</small></span><ChevronRight size={16} /></button>)}</div></section>;
}

function FinanceSettingsSection() {
  return <section className="panel finance-table-section"><div className="panel-header"><div className="panel-title"><h3>Account Settings</h3><p>Controls for numbering, tax, approvals and financial periods</p></div><span className="badge badge-success">Configuration healthy</span></div><div className="settings-grid">{["Chart of Accounts", "Fiscal Year & Closing", "Invoice Numbering", "GST & TDS Settings", "Bank Accounts", "Approval Workflow", "Cost Allocation Rules", "Financial Permissions"].map((setting) => <div key={setting}><Settings size={18} /><span>{setting}<small>Review and manage settings</small></span><ChevronRight size={16} /></div>)}</div></section>;
}

/* =========================================================================
   1. DASHBOARD VIEW
========================================================================= */
function DashboardView({
  targetProgress,
  totalProduced,
  dailyTarget,
  rejectRate,
  lowStockCount,
  downtimeMinutes,
  totalOutstanding,
  products,
  entries,
  invoices,
  dispatches,
  notices,
  machines,
  workOrders,
  qcInspections,
  setView,
}: {
  targetProgress: number;
  totalProduced: number;
  dailyTarget: number;
  rejectRate: number;
  lowStockCount: number;
  downtimeMinutes: number;
  totalOutstanding: number;
  products: Product[];
  entries: ProductionEntry[];
  invoices: Invoice[];
  dispatches: Dispatch[];
  notices: PlantNotice[];
  machines: Machine[];
  workOrders: WorkOrder[];
  qcInspections: QcInspection[];
  setView: (v: View) => void;
}) {
  const runningMachines = machines.filter((m) => m.status === "Running").length;
  const breakdownMachines = machines.filter((m) => m.status === "Breakdown").length;
  const idleMachines = machines.filter((m) => m.status === "Idle").length;
  const openWorkOrders = workOrders.filter((w) => w.status === "In Progress" || w.status === "Released").length;
  const overdueWO = workOrders.filter((w) => w.dueDate < today && w.status !== "Completed" && w.status !== "Closed").length;
  const qualityAlerts = qcInspections.filter((q) => q.status === "On Hold" || q.status === "Rejected").length;
  const pendingDispatches = dispatches.filter((d) => d.status === "dispatched").length;

  // Sort machines: Breakdown first, then Idle, then Running, then Maintenance
  const sortedMachines = [...machines].sort((a, b) => {
    const order = { Breakdown: 0, Idle: 1, Maintenance: 2, Running: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const machineStatusBadge = (status: Machine["status"]) => {
    const map: Record<Machine["status"], string> = {
      Running: "badge-green",
      Idle: "badge-orange",
      Breakdown: "badge-danger",
      Maintenance: "badge-blue",
    };
    return map[status] ?? "badge-gray";
  };

  const machineStatusDot = (status: Machine["status"]) => {
    const map: Record<Machine["status"], string> = {
      Running: "green",
      Idle: "orange",
      Breakdown: "red",
      Maintenance: "blue",
    };
    return map[status] ?? "gray";
  };

  return (
    <>
      {/* 6 Metric KPI Cards — Blueprint Section 3.1 */}
      <div className="metric-grid">
        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("entry")}>
          <div className="metric-icon-box teal">
            <Gauge size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Today's Production</span>
            <span className="metric-value">{numberFmt.format(totalProduced)} <small style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>/ {numberFmt.format(dailyTarget)}</small></span>
            <span className="metric-sub">{targetProgress}% of Daily Target</span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("work_orders")}>
          <div className="metric-icon-box blue">
            <ClipboardList size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Open Work Orders</span>
            <span className="metric-value">{openWorkOrders}</span>
            <span className="metric-sub">{overdueWO > 0 ? `${overdueWO} overdue` : "All on schedule"}</span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("machines")}>
          <div className={`metric-icon-box ${breakdownMachines > 0 ? "red" : "green"}`}>
            <Wrench size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Machine Status</span>
            <span className="metric-value">{runningMachines} <small style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>/ {machines.length}</small></span>
            <span className="metric-sub">{breakdownMachines > 0 ? `${breakdownMachines} breakdown · ${idleMachines} idle` : `${idleMachines} idle · All healthy`}</span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("inventory")}>
          <div className={`metric-icon-box ${lowStockCount > 0 ? "orange" : "green"}`}>
            <AlertTriangle size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Material Risk</span>
            <span className="metric-value">{lowStockCount}</span>
            <span className="metric-sub">{lowStockCount === 0 ? "Inventory Healthy" : `${lowStockCount} below threshold`}</span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("qc")}>
          <div className={`metric-icon-box ${qualityAlerts > 0 ? "red" : "green"}`}>
            <ShieldAlert size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Quality Alerts</span>
            <span className="metric-value">{qualityAlerts}</span>
            <span className="metric-sub">{qualityAlerts === 0 ? "No QC holds" : `${qualityAlerts} on hold / rejected`}</span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: "pointer" }} onClick={() => setView("dispatch")}>
          <div className="metric-icon-box cyan">
            <Truck size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Dispatch Pending</span>
            <span className="metric-value">{pendingDispatches}</span>
            <span className="metric-sub">{pendingDispatches === 0 ? "All shipments delivered" : `${pendingDispatches} in transit`}</span>
          </div>
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Quick Plant Operations</h3>
            <p>Direct shortcuts to operator and managerial actions</p>
          </div>
        </div>
        <div className="quick-action-strip">
          <button className="quick-action-btn" onClick={() => setView("entry")}>
            <div className="icon-box" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <Plus size={22} />
            </div>
            <span>Log Production</span>
          </button>
          <button className="quick-action-btn" onClick={() => setView("work_orders")}>
            <div className="icon-box" style={{ background: "var(--status-blue-bg)", color: "var(--status-blue)" }}>
              <ClipboardList size={22} />
            </div>
            <span>Work Orders</span>
          </button>
          <button className="quick-action-btn" onClick={() => setView("inventory")}>
            <div className="icon-box" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <PackagePlus size={22} />
            </div>
            <span>Stock In / Out</span>
          </button>
          <button className="quick-action-btn" onClick={() => setView("billing")}>
            <div className="icon-box" style={{ background: "var(--purple-bg)", color: "var(--purple)" }}>
              <ReceiptText size={22} />
            </div>
            <span>Create GST Invoice</span>
          </button>
          <button className="quick-action-btn" onClick={() => setView("dispatch")}>
            <div className="icon-box" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
              <Truck size={22} />
            </div>
            <span>Dispatch Order</span>
          </button>
        </div>
      </div>

      {/* Machine Status Board — Blueprint Section 3.2 (Breakdown rows first) */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Machine Status Board</h3>
            <p>Live floor status — breakdowns surface first</p>
          </div>
          <button className="btn-outline btn-sm" onClick={() => setView("machines")}>
            Maintenance Log <ChevronRight size={14} />
          </button>
        </div>
        <div className="machine-board">
          {sortedMachines.map((m) => (
            <div key={m.id} className={`machine-card ${m.status === "Breakdown" ? "breakdown" : ""}`}>
              <div className="machine-card-header">
                <span className="machine-code">{m.code}</span>
                <span className={`badge ${machineStatusBadge(m.status)}`}>
                  <span className={`status-dot ${machineStatusDot(m.status)}`} />
                  {m.status}
                </span>
              </div>
              <div className="machine-name">{m.name}</div>
              <div className="machine-meta">{m.type} · {m.location}</div>
              {m.currentOperator && (
                <div className="machine-meta">Operator: <strong>{m.currentOperator}</strong></div>
              )}
              {m.status === "Breakdown" && (
                <div style={{ fontSize: "0.74rem", color: "var(--status-red)", fontWeight: 700, marginTop: "0.25rem" }}>
                  Breakdown — needs immediate attention
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2-Column: Production Progress + Plant Bulletins */}
      <div className="grid-2">
        {/* Production Progress By Product */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Today's Output by Product</h3>
              <p>Live progress tracking against daily production targets</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {products.map((p) => {
              const produced = entries
                .filter((e) => e.productId === p.id)
                .reduce((sum, e) => sum + e.quantityProduced, 0);
              const progress = Math.min(100, Math.round((produced / p.dailyTarget) * 100));

              return (
                <div key={p.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem", marginBottom: "0.25rem" }}>
                    <strong>{p.name}</strong>
                    <span>
                      <strong>{produced}</strong> / {p.dailyTarget} {p.unit} ({progress}%)
                    </span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    Finished Goods in Stock: <strong>{p.currentFinishedStock} {p.unit}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Plant Bulletins */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Plant Bulletins & Quality Alerts</h3>
              <p>Maintenance, quality and shift announcements</p>
            </div>
            <button className="btn-outline btn-sm" onClick={() => setView("notices")}>
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div>
            {notices.map((n) => (
              <div key={n.id} className={`notice-item ${n.priority.toLowerCase()}`}>
                <div className="notice-meta">
                  <span><strong>{n.issuedBy}</strong> · Shift: <span className="badge badge-teal">{n.targetShift}</span></span>
                  <span>{n.date} · <span className={`badge badge-${n.priority === "Urgent" ? "danger" : "warning"}`}>{n.priority}</span></span>
                </div>
                <h4>{n.title}</h4>
                <p>{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Dispatches Tracker */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Active Logistics & Shipments</h3>
            <p>Vehicles dispatched and in-transit to clients</p>
          </div>
          <button className="btn-outline btn-sm" onClick={() => setView("dispatch")}>
            Full Tracker <ChevronRight size={14} />
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Client Name</th>
                <th>Transport Provider</th>
                <th>Tracking / Vehicle #</th>
                <th>Freight Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.orderNumber}</strong></td>
                  <td>{d.partyName}</td>
                  <td>{d.transportProvider} ({d.vehicleType})</td>
                  <td><code>{d.trackingId}</code></td>
                  <td>{rupee.format(d.cost)}</td>
                  <td>
                    <span className={`badge badge-${d.status === "delivered" ? "success" : d.status === "in_transit" ? "warning" : "info"}`}>
                      {d.status.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   2. SHOP-FLOOR PRODUCTION ENTRY VIEW
========================================================================= */
function ProductionEntryView({
  products,
  activeBoms,
  materials,
  todayEntries,
  onAddEntry,
}: {
  products: Product[];
  activeBoms: Bom[];
  materials: Material[];
  todayEntries: ProductionEntry[];
  onAddEntry: (form: any) => void;
}) {
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    quantityProduced: "",
    quantityRejected: "0",
    rejectReason: "",
    shift: "Morning (08:00 - 16:00)" as Shift,
    machineId: "Injection Molding Machine #01 (L&T 250T)",
    downtimeMinutes: "0",
    downtimeReason: "",
  });

  const selectedProduct = products.find((p) => p.id === form.productId);
  const selectedBom = activeBoms.find((b) => b.productId === form.productId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || Number(form.quantityProduced) <= 0) return;

    onAddEntry({
      productId: form.productId,
      quantityProduced: Number(form.quantityProduced),
      quantityRejected: Number(form.quantityRejected || 0),
      rejectReason: form.rejectReason.trim(),
      shift: form.shift,
      machineId: form.machineId,
      downtimeMinutes: Number(form.downtimeMinutes || 0),
      downtimeReason: form.downtimeReason.trim(),
    });

    setForm((cur) => ({
      ...cur,
      quantityProduced: "",
      quantityRejected: "0",
      rejectReason: "",
      downtimeMinutes: "0",
      downtimeReason: "",
    }));
  };

  return (
    <div className="content-grid">
      <div className="grid-2">
        {/* Entry Form */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Shop-Floor Operator Entry Form</h3>
              <p>Log output batch & automatically deduct BOM raw materials</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-panel">
            <div className="form-group">
              <label>Select Product *</label>
              <select
                className="form-control"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Produced Qty ({selectedProduct?.unit || "units"}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-control"
                  placeholder="e.g. 250"
                  value={form.quantityProduced}
                  onChange={(e) => setForm({ ...form, quantityProduced: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Rejected Qty ({selectedProduct?.unit || "units"})</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={form.quantityRejected}
                  onChange={(e) => setForm({ ...form, quantityRejected: e.target.value })}
                />
              </div>
            </div>

            {Number(form.quantityRejected) > 0 && (
              <div className="form-group">
                <label>Reject Reason / Defect Note</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Warping, Short shot, Flash"
                  value={form.rejectReason}
                  onChange={(e) => setForm({ ...form, rejectReason: e.target.value })}
                />
              </div>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label>Active Shift</label>
                <select
                  className="form-control"
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value as Shift })}
                >
                  <option value="Morning (08:00 - 16:00)">Morning (08:00 - 16:00)</option>
                  <option value="Evening (16:00 - 00:00)">Evening (16:00 - 00:00)</option>
                  <option value="Night (00:00 - 08:00)">Night (00:00 - 08:00)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Machine / Workstation</label>
                <select
                  className="form-control"
                  value={form.machineId}
                  onChange={(e) => setForm({ ...form, machineId: e.target.value })}
                >
                  <option value="Injection Molding Machine #01 (L&T 250T)">L&T 250T (Machine #01)</option>
                  <option value="Injection Molding Machine #02 (Windsor 180T)">Windsor 180T (Machine #02)</option>
                  <option value="Auxiliary Assembly Station">Auxiliary Assembly</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Downtime (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={form.downtimeMinutes}
                  onChange={(e) => setForm({ ...form, downtimeMinutes: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Downtime Reason</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Die cleaning, Material feeder reload"
                  value={form.downtimeReason}
                  onChange={(e) => setForm({ ...form, downtimeReason: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}>
              <CheckCircle size={18} /> Save Batch & Deduct BOM Stock
            </button>
          </form>
        </div>

        {/* Live BOM Breakdown Card */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Active BOM Deduction Preview</h3>
              <p>Locked recipe version: <strong>v{selectedBom?.version ?? 1}</strong></p>
            </div>
            <span className="badge badge-teal">BOM v{selectedBom?.version} Active</span>
          </div>

          <div style={{ background: "var(--primary-light)", padding: "1rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.85rem" }}>
            <div>Target Product: <strong>{selectedProduct?.name}</strong></div>
            <div>Estimated batch size: <strong>{Number(form.quantityProduced) || 0} {selectedProduct?.unit}</strong></div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Per Unit Qty</th>
                  <th>Batch Requirement</th>
                  <th>Current Stock</th>
                </tr>
              </thead>
              <tbody>
                {selectedBom?.lineItems.map((line) => {
                  const mat = materials.find((m) => m.id === line.materialId);
                  const req = line.qtyPerUnit * (Number(form.quantityProduced) || 0);
                  const isShort = mat ? mat.currentStock < req : false;

                  return (
                    <tr key={line.materialId}>
                      <td><strong>{mat?.name}</strong></td>
                      <td>{line.qtyPerUnit} {mat?.unit}</td>
                      <td><strong style={{ color: isShort ? "var(--danger)" : "var(--primary)" }}>{req.toFixed(2)} {mat?.unit}</strong></td>
                      <td>
                        <span className={`badge badge-${isShort ? "danger" : "success"}`}>
                          {mat?.currentStock} {mat?.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Today's Log History */}
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Today's Production Run Log ({todayEntries.length} Batches)</h3>
            <p>Real-time audit register recorded on the shop floor</p>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Product</th>
                <th>Produced</th>
                <th>Rejected</th>
                <th>Shift</th>
                <th>Machine</th>
                <th>Downtime</th>
                <th>Supervisor</th>
              </tr>
            </thead>
            <tbody>
              {todayEntries.map((e) => {
                const prod = products.find((p) => p.id === e.productId);
                return (
                  <tr key={e.id}>
                    <td>{e.createdAt.slice(11, 16)}</td>
                    <td><strong>{prod?.name}</strong></td>
                    <td><strong style={{ color: "var(--success)" }}>+{e.quantityProduced} {prod?.unit}</strong></td>
                    <td>{e.quantityRejected > 0 ? <span className="badge badge-danger">{e.quantityRejected}</span> : "-"}</td>
                    <td><span className="badge badge-info">{e.shift.slice(0, 7)}</span></td>
                    <td><small>{e.machineId}</small></td>
                    <td>{e.downtimeMinutes > 0 ? `${e.downtimeMinutes}m (${e.downtimeReason})` : "-"}</td>
                    <td>{e.enteredBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   3. INVENTORY & STOCK VIEW
========================================================================= */
function InventoryView({
  materials,
  stockMovements,
  onAddMovement,
}: {
  materials: Material[];
  stockMovements: StockMovement[];
  onAddMovement: (form: any) => void;
}) {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState({
    materialId: materials[0]?.id ?? "",
    type: "in" as "in" | "out",
    quantity: "",
    note: "",
  });

  const filtered = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.materialId || Number(form.quantity) <= 0) return;

    onAddMovement({
      materialId: form.materialId,
      type: form.type,
      quantity: Number(form.quantity),
      note: form.note.trim(),
    });

    setShowModal(false);
    setForm({ materialId: materials[0]?.id ?? "", type: "in", quantity: "", note: "" });
  };

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Raw Material Inventory Master ({materials.length} Items)</h3>
            <p>Live inventory stocks, reorder thresholds, and warehouse valuation</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(!showModal)}>
            <PackagePlus size={18} /> Record Stock IN / OUT
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: "1.25rem", position: "relative", maxWidth: "420px" }}>
          <input
            className="form-control"
            style={{ width: "100%", paddingLeft: "2.2rem" }}
            placeholder="Search material by name, item code, category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        </div>

        {/* Materials Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Threshold</th>
                <th>Unit Cost</th>
                <th>Valuation</th>
                <th>Stock Health</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isLow = m.currentStock <= m.lowStockThreshold;
                const value = m.currentStock * m.unitCost;

                return (
                  <tr key={m.id}>
                    <td><code>{m.code}</code></td>
                    <td><strong>{m.name}</strong></td>
                    <td><span className="badge badge-purple">{m.category}</span></td>
                    <td><strong>{m.currentStock} {m.unit}</strong></td>
                    <td>{m.lowStockThreshold} {m.unit}</td>
                    <td>{rupee.format(m.unitCost)}</td>
                    <td>{rupee.format(value)}</td>
                    <td>
                      <span className={`badge badge-${isLow ? "danger" : "success"}`}>
                        {isLow ? "Low Stock (Reorder)" : "Healthy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock IN / OUT Modal */}
      {showModal && (
        <div className="panel" style={{ border: "2px solid var(--primary)", marginTop: "1.5rem" }}>
          <div className="panel-header">
            <div className="panel-title">
              <h3>Manual Stock Movement Entry</h3>
              <p>Inward supplier purchases or issue material to shop floor</p>
            </div>
            <button className="btn-outline btn-sm" onClick={() => setShowModal(false)}>Close</button>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group">
              <label>Select Material *</label>
              <select
                className="form-control"
                value={form.materialId}
                onChange={(e) => setForm({ ...form, materialId: e.target.value })}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (Stock: {m.currentStock} {m.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Movement Type *</label>
              <select
                className="form-control"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as "in" | "out" })}
              >
                <option value="in">STOCK IN (+) (Supplier Purchase Inward)</option>
                <option value="out">STOCK OUT (-) (Direct Shop Floor Issue)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                className="form-control"
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Reference / Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. PO-8821 from Supplier"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary"><CheckCircle size={18} /> Record Movement</button>
            </div>
          </form>
        </div>
      )}

      {/* Audit Stock Movement Trail */}
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Recent Stock Movement Audit Trail</h3>
            <p>Chronological inward/outward and automated production consumption ledger</p>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Material</th>
                <th>Movement Type</th>
                <th>Quantity</th>
                <th>Reason / Reference</th>
                <th>Logged By</th>
              </tr>
            </thead>
            <tbody>
              {stockMovements.slice(0, 10).map((mov) => {
                const mat = materials.find((m) => m.id === mov.materialId);
                const isIn = mov.type === "in";

                return (
                  <tr key={mov.id}>
                    <td>{mov.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td><strong>{mat?.name}</strong></td>
                    <td>
                      <span className={`badge badge-${isIn ? "success" : "warning"}`}>
                        {mov.type.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: isIn ? "var(--success)" : "var(--danger)" }}>
                        {isIn ? `+${mov.quantity}` : `-${mov.quantity}`} {mat?.unit}
                      </strong>
                    </td>
                    <td>{mov.note}</td>
                    <td>{mov.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
   4. BOM & RECIPES VIEW
========================================================================= */
function BomView({
  products,
  boms,
  materials,
}: {
  products: Product[];
  boms: Bom[];
  materials: Material[];
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <h3>Bill of Materials (BOM) Master Recipes</h3>
          <p>Standard raw material formulation per finished product piece</p>
        </div>
      </div>

      <div className="grid-3">
        {products.map((p) => {
          const bom = boms.find((b) => b.productId === p.id && b.isActive);
          const rawMaterialCost = (bom?.lineItems || []).reduce((sum, line) => {
            const mat = materials.find((m) => m.id === line.materialId);
            return sum + (mat ? mat.unitCost * line.qtyPerUnit : 0);
          }, 0);

          return (
            <div key={p.id} className="panel" style={{ border: "1px solid var(--card-border)" }}>
              <div className="panel-header">
                <div>
                  <span className="badge badge-teal">{p.code}</span>
                  <h4 style={{ fontSize: "1.05rem", marginTop: "0.35rem" }}>{p.name}</h4>
                </div>
                <span className="badge badge-success">v{bom?.version} Active</span>
              </div>

              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "var(--radius-md)", marginBottom: "1rem", fontSize: "0.82rem" }}>
                <div>Raw Material Cost: <strong>{rupee.format(rawMaterialCost)} / unit</strong></div>
                <div>Selling Price: <strong>{rupee.format(p.sellingPrice)} / unit</strong></div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Qty / {p.unit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bom?.lineItems.map((line) => {
                      const mat = materials.find((m) => m.id === line.materialId);
                      return (
                        <tr key={line.materialId}>
                          <td><strong>{mat?.name}</strong></td>
                          <td>{line.qtyPerUnit} {mat?.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================================
   5. GST BILLING VIEW
========================================================================= */
function BillingView({
  invoices,
  parties,
  products,
  totalOutstanding,
  overdueCount,
  onCreateInvoice,
}: {
  invoices: Invoice[];
  parties: Party[];
  products: Product[];
  totalOutstanding: number;
  overdueCount: number;
  onCreateInvoice: (form: any) => void;
}) {
  const [form, setForm] = useState({
    partyId: parties[0]?.id ?? "",
    productId: products[0]?.id ?? "",
    quantity: "",
    rate: "",
    gstRate: "18",
    paidAmount: "0",
  });

  const selectedProduct = products.find((p) => p.id === form.productId);
  const qty = Number(form.quantity || 0);
  const rate = Number(form.rate || (selectedProduct ? selectedProduct.sellingPrice : 0));
  const subtotal = qty * rate;
  const gstAmount = Math.round((subtotal * Number(form.gstRate)) / 100);
  const total = subtotal + gstAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.partyId || !form.productId || qty <= 0 || rate <= 0) return;

    onCreateInvoice({
      partyId: form.partyId,
      productId: form.productId,
      quantity: qty,
      rate,
      gstRate: Number(form.gstRate),
      paidAmount: Number(form.paidAmount || 0),
    });

    setForm({ partyId: parties[0]?.id ?? "", productId: products[0]?.id ?? "", quantity: "", rate: "", gstRate: "18", paidAmount: "0" });
  };

  return (
    <div className="content-grid">
      <div className="grid-2">
        {/* Create Invoice Form */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Generate GST Tax Invoice</h3>
              <p>Create digital invoice and automatically add to client ledger</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-panel">
            <div className="form-group">
              <label>Select Customer / Client *</label>
              <select
                className="form-control"
                value={form.partyId}
                onChange={(e) => setForm({ ...form, partyId: e.target.value })}
              >
                {parties.filter((p) => p.type === "Customer").map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.city})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Select Finished Product *</label>
              <select
                className="form-control"
                value={form.productId}
                onChange={(e) => {
                  const p = products.find((prod) => prod.id === e.target.value);
                  setForm({ ...form, productId: e.target.value, rate: p ? p.sellingPrice.toString() : "" });
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Stock: {p.currentFinishedStock} {p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Billing Quantity ({selectedProduct?.unit || "pcs"}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-control"
                  placeholder="e.g. 100"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Unit Rate (₹)</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="form-control"
                  placeholder="Rate"
                  value={form.rate || (selectedProduct ? selectedProduct.sellingPrice.toString() : "")}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>GST Slab Rate (%)</label>
                <select
                  className="form-control"
                  value={form.gstRate}
                  onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
                >
                  <option value="0">0% (Exempted)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST</option>
                </select>
              </div>

              <div className="form-group">
                <label>Advance Payment Received (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={form.paidAmount}
                  onChange={(e) => setForm({ ...form, paidAmount: e.target.value })}
                />
              </div>
            </div>

            {total > 0 && (
              <div style={{ background: "var(--primary-light)", padding: "0.85rem", borderRadius: "var(--radius-md)", fontSize: "0.85rem" }}>
                <div>Subtotal: <strong>{rupee.format(subtotal)}</strong> + GST ({form.gstRate}%): <strong>{rupee.format(gstAmount)}</strong></div>
                <div style={{ fontSize: "1.1rem", marginTop: "0.3rem", color: "var(--primary-hover)" }}>Invoice Total: <strong>{rupee.format(total)}</strong></div>
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              <ReceiptText size={18} /> Generate Tax Invoice
            </button>
          </form>
        </div>

        {/* Invoice Summary & Metrics */}
        <div className="panel">
          <div className="metric-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="metric-card" style={{ padding: "1rem" }}>
              <div className="metric-data">
                <span className="metric-label">Outstanding</span>
                <span className="metric-value" style={{ fontSize: "1.3rem" }}>{rupee.format(totalOutstanding)}</span>
              </div>
            </div>
            <div className="metric-card" style={{ padding: "1rem" }}>
              <div className="metric-data">
                <span className="metric-label">Overdue Bills</span>
                <span className="metric-value" style={{ fontSize: "1.3rem", color: "var(--danger)" }}>{overdueCount}</span>
              </div>
            </div>
          </div>

          <div className="panel-header">
            <div className="panel-title">
              <h3>GST Invoices Master</h3>
              <p>Downloadable and shareable invoices</p>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const party = parties.find((p) => p.id === inv.partyId);
                  const isOverdue = inv.status === "overdue" || (inv.status !== "paid" && inv.dueDate < today);

                  return (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{party?.name}</td>
                      <td><strong>{rupee.format(inv.total)}</strong></td>
                      <td>
                        <span className={`badge badge-${inv.status === "paid" ? "success" : isOverdue ? "danger" : "warning"}`}>
                          {isOverdue && inv.status !== "paid" ? "Overdue" : inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <a
                          className="btn-whatsapp"
                          href={`https://wa.me/${party?.phone}?text=${encodeURIComponent(`Dear ${party?.name}, Tax Invoice ${inv.invoiceNumber} for ${rupee.format(inv.total)} from Rajput Plastics is ready. Due Date: ${inv.dueDate}. Please arrange the payment.`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   6. CLIENT CRM & RECEIVABLES PORTAL
========================================================================= */
function ClientsCrmView({
  parties,
  partyBalances,
  ledgerEntries,
  invoices,
  userRole,
  onClientCreated,
  setView,
  showToast,
}: {
  parties: Party[];
  partyBalances: any[];
  ledgerEntries: LedgerEntry[];
  invoices: Invoice[];
  userRole: "owner" | "supervisor" | "ca";
  onClientCreated: (client: Party) => void;
  setView: (v: View) => void;
  showToast: (msg: string) => void;
}) {
  // ROLE SECURITY GUARD: Supervisor has NO access to CRM
  if (userRole === "supervisor") {
    return (
      <div className="panel" style={{ borderLeft: "4px solid var(--danger)", padding: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "var(--danger)" }}>
          <AlertTriangle size={32} />
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Access Denied (RBAC Security Guard)</h2>
            <p style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Shop-Floor Supervisors do not have permission to view Client CRM, Accounts, or Receivables data.
              This route is restricted to Plant Owners and CA / Accountants.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnly = userRole === "ca";

  // State
  const [selectedClientId, setSelectedClientId] = useState<string>(partyBalances[0]?.id ?? "");
  const [filterCard, setFilterCard] = useState<"all" | "active" | "dormant" | "overdue60" | "dueToday">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Follow-ups & Timeline state
  const [dueFollowUps, setDueFollowUps] = useState<ClientFollowUp[]>(() => dataService.listDueFollowUps(today));
  const [interactions, setInteractions] = useState<ClientInteraction[]>(() =>
    selectedClientId ? dataService.listInteractions(selectedClientId) : []
  );

  // New Client Form state
  const [clientForm, setClientForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    city: "Jaipur",
    gstin: "",
    type: "Customer" as PartyType,
    clientCategory: "dealer" as ClientCategory,
    tags: "Dealer, Regional",
    creditLimit: "150000",
    payment_terms_days: "15",
    notes: "",
  });
  const [formError, setFormError] = useState("");

  // New Interaction Form state
  const [interactionForm, setInteractionForm] = useState({
    type: "call" as InteractionType,
    text: "",
  });

  // New Follow-up Form state
  const [followUpForm, setFollowUpForm] = useState({
    dueDate: today,
    reason: "",
  });

  // Sync interactions when selectedClientId changes
  useEffect(() => {
    if (selectedClientId) {
      setInteractions(dataService.listInteractions(selectedClientId));
    }
  }, [selectedClientId]);

  // Compute Client KPIs
  const clientBalances = useMemo(() => {
    return partyBalances.map((party) => {
      const partyInvoices = invoices.filter((i) => i.partyId === party.id);
      const partyLedger = ledgerEntries.filter((e) => e.partyId === party.id);
      const totalPayments = partyLedger.filter((e) => e.type === "credit").reduce((sum, e) => sum + e.amount, 0);

      const aging = calculateAgingBuckets(partyInvoices, totalPayments, today);
      const dormant = isDormant(party.lastOrderDate, today);
      const computedStatus: ClientStatus = party.status === "blocked" ? "blocked" : dormant ? "dormant" : party.lastOrderDate ? "active" : "lead";

      return {
        ...party,
        aging,
        computedStatus,
        isOverCredit: isCreditLimitExceeded(party.balance, party.creditLimit),
      };
    });
  }, [partyBalances, invoices, ledgerEntries]);

  // Dashboard Aggregates
  const totalClients = clientBalances.length;
  const activeCount = clientBalances.filter((c) => c.computedStatus === "active" || c.computedStatus === "lead").length;
  const dormantCount = clientBalances.filter((c) => c.computedStatus === "dormant").length;
  const totalOutstanding = clientBalances.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const overdue60Amount = clientBalances.reduce((sum, c) => sum + c.aging.totalOverdue60Plus, 0);
  const callsDueCount = dueFollowUps.length;

  // Filtered Client List
  const filteredClients = useMemo(() => {
    return clientBalances.filter((c) => {
      // Filter by card selection
      if (filterCard === "active" && c.computedStatus !== "active" && c.computedStatus !== "lead") return false;
      if (filterCard === "dormant" && c.computedStatus !== "dormant") return false;
      if (filterCard === "overdue60" && c.aging.totalOverdue60Plus <= 0) return false;

      // Category filter
      if (categoryFilter !== "all" && c.clientCategory !== categoryFilter) return false;

      // Search query
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesPhone = c.phone.includes(q);
        const matchesCity = c.city.toLowerCase().includes(q);
        const matchesTags = c.tags?.some((t: string) => t.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesCity && !matchesTags) return false;
      }

      return true;
    });
  }, [clientBalances, filterCard, categoryFilter, searchQuery]);

  const selectedClient = clientBalances.find((c) => c.id === selectedClientId) ?? filteredClients[0] ?? clientBalances[0];

  // Handlers
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    try {
      const newClient = dataService.createClient({
        name: clientForm.name,
        phone: clientForm.phone,
        type: clientForm.type,
        clientCategory: clientForm.clientCategory,
        whatsapp: clientForm.whatsapp || clientForm.phone,
        city: clientForm.city,
        gstin: clientForm.gstin,
        tags: clientForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        creditLimit: Number(clientForm.creditLimit || 0),
        payment_terms_days: Number(clientForm.payment_terms_days || 15),
        notes: clientForm.notes,
      });

      onClientCreated(newClient);
      setSelectedClientId(newClient.id);
      setShowAddModal(false);
      showToast(`✓ Client "${newClient.name}" created successfully.`);

      setClientForm({
        name: "",
        phone: "",
        whatsapp: "",
        city: "Jaipur",
        gstin: "",
        type: "Customer",
        clientCategory: "dealer",
        tags: "Dealer, Regional",
        creditLimit: "150000",
        payment_terms_days: "15",
        notes: "",
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to create client");
    }
  };

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !interactionForm.text) return;

    const newInt = dataService.addInteraction(selectedClient.id, {
      type: interactionForm.type,
      text: interactionForm.text,
      createdBy: "Ayush Rajput (Owner)",
    });

    setInteractions([newInt, ...interactions]);
    setInteractionForm({ type: "call", text: "" });
    showToast("✓ Interaction logged on timeline.");
  };

  const handleCreateFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !followUpForm.reason) return;

    dataService.createFollowUp(selectedClient.id, {
      dueDate: followUpForm.dueDate,
      reason: followUpForm.reason,
    });

    setDueFollowUps(dataService.listDueFollowUps(today));
    setFollowUpForm({ dueDate: today, reason: "" });
    showToast("✓ Follow-up task scheduled.");
  };

  const handleCompleteFollowUp = (id: string) => {
    dataService.completeFollowUp(id);
    setDueFollowUps(dataService.listDueFollowUps(today));
    showToast("✓ Follow-up task completed!");
  };

  return (
    <div className="content-grid">
      {/* 1. Dashboard KPI Strip */}
      <div className="metric-grid">
        <div
          className={`metric-card ${filterCard === "all" ? "active-card" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("all")}
        >
          <div className="metric-icon-box teal">
            <Users size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Total Clients</span>
            <div className="metric-value">{totalClients}</div>
            <span className="metric-sub">Master Directory</span>
          </div>
        </div>

        <div
          className={`metric-card ${filterCard === "active" ? "active-card" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("active")}
        >
          <div className="metric-icon-box green">
            <CheckCircle size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Active Buyers</span>
            <div className="metric-value">{activeCount}</div>
            <span className="metric-sub">Ordered in &lt; 30 Days</span>
          </div>
        </div>

        <div
          className={`metric-card ${filterCard === "dormant" ? "active-card" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("dormant")}
        >
          <div className="metric-icon-box amber">
            <AlertTriangle size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Dormant Clients</span>
            <div className="metric-value">{dormantCount}</div>
            <span className="metric-sub">No Order in 30+ Days</span>
          </div>
        </div>

        <div
          className="metric-card"
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("all")}
        >
          <div className="metric-icon-box purple">
            <IndianRupee size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Total Outstanding</span>
            <div className="metric-value">{rupee.format(totalOutstanding)}</div>
            <span className="metric-sub">Net Receivables</span>
          </div>
        </div>

        <div
          className={`metric-card ${filterCard === "overdue60" ? "active-card" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("overdue60")}
        >
          <div className="metric-icon-box rose">
            <Clock size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Overdue 60+ Days</span>
            <div className="metric-value">{rupee.format(overdue60Amount)}</div>
            <span className="metric-sub">High Collection Risk</span>
          </div>
        </div>

        <div
          className={`metric-card ${filterCard === "dueToday" ? "active-card" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setFilterCard("dueToday")}
        >
          <div className="metric-icon-box cyan">
            <MessageCircle size={22} />
          </div>
          <div className="metric-data">
            <span className="metric-label">Today's Calls / Tasks</span>
            <div className="metric-value">{callsDueCount}</div>
            <span className="metric-sub">Action Items Pending</span>
          </div>
        </div>
      </div>

      {/* 2. Today's Calls & Follow-up Panel */}
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Today's Call List & Pending Follow-ups ({dueFollowUps.length})</h3>
            <p>Priority call tasks, dormant re-engagement & payment recovery follow-ups</p>
          </div>
        </div>

        {dueFollowUps.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: "0.5rem 0" }}>
            ✓ No pending call tasks due today. All follow-ups are up to date!
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Target Client</th>
                  <th>Contact Phone</th>
                  <th>Follow-up Reason / Task</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dueFollowUps.map((task) => {
                  const client = clientBalances.find((c) => c.id === task.clientId);
                  return (
                    <tr key={task.id}>
                      <td>
                        <strong>{client?.name || "Client"}</strong>
                        <br />
                        <small>{client?.city}</small>
                      </td>
                      <td>{client?.phone}</td>
                      <td>
                        <span>{task.reason}</span>
                        {task.autoSuggested && <span className="badge badge-warning" style={{ marginLeft: "0.5rem" }}>Auto-Suggested</span>}
                      </td>
                      <td>
                        <span className="badge badge-danger">{task.dueDate}</span>
                      </td>
                      <td>
                        {!isReadOnly && (
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => handleCompleteFollowUp(task.id)}
                            type="button"
                          >
                            <CheckCircle size={14} /> Mark Completed
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Main CRM Client Directory Panel */}
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Client Directory & Receivables ({filteredClients.length} Clients)</h3>
            <p>Filter by status, search contacts and inspect FIFO aging buckets</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {!isReadOnly && (
              <button className="btn-primary" onClick={() => setShowAddModal(true)} type="button">
                <Plus size={18} /> Add New Client
              </button>
            )}
            <button className="btn-outline" onClick={() => setView("billing")} type="button">
              <ReceiptText size={18} /> New GST Invoice
            </button>
          </div>
        </div>

        {/* Search & Filters Controls */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          <div className="form-group" style={{ flex: 1, minWidth: "240px", margin: 0 }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by client name, phone, city, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ minWidth: "160px", margin: 0 }}>
            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Category: All</option>
              <option value="dealer">Dealer</option>
              <option value="retailer">Retailer</option>
              <option value="direct">Direct</option>
            </select>
          </div>

          {filterCard !== "all" && (
            <button className="btn-outline btn-sm" onClick={() => setFilterCard("all")} type="button">
              Clear Card Filter ({filterCard.toUpperCase()})
            </button>
          )}
        </div>

        {/* Client Directory Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Client Name & Category</th>
                <th>Phone & WhatsApp</th>
                <th>City & GSTIN</th>
                <th>Status</th>
                <th>Credit Limit</th>
                <th>Balance Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr
                  key={client.id}
                  style={{
                    cursor: "pointer",
                    background: client.id === selectedClient?.id ? "var(--primary-light)" : undefined,
                  }}
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <td>
                    <strong>{client.name}</strong>
                    <br />
                    <span className="badge badge-teal" style={{ textTransform: "capitalize" }}>
                      {client.clientCategory || "dealer"}
                    </span>
                    {client.tags?.map((t: string) => (
                      <span key={t} className="badge badge-purple" style={{ marginLeft: "0.25rem" }}>
                        {t}
                      </span>
                    ))}
                  </td>
                  <td>
                    {client.phone}
                    <br />
                    <a
                      href={`https://wa.me/${client.whatsapp || client.phone}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.76rem", color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      WhatsApp Direct
                    </a>
                  </td>
                  <td>
                    {client.city}
                    <br />
                    <code>{client.gstin || "URP (Unregistered)"}</code>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${
                        client.computedStatus === "active"
                          ? "success"
                          : client.computedStatus === "dormant"
                          ? "warning"
                          : client.computedStatus === "blocked"
                          ? "danger"
                          : "info"
                      }`}
                    >
                      {client.computedStatus.toUpperCase()}
                    </span>
                  </td>
                  <td>{rupee.format(client.creditLimit)}</td>
                  <td>
                    <strong style={{ color: client.balance > 0 ? "var(--danger)" : "var(--success)" }}>
                      {rupee.format(client.balance)}
                    </strong>
                    {client.isOverCredit && (
                      <div>
                        <span className="badge badge-danger">
                          Exceeds Limit by {rupee.format(client.balance - client.creditLimit)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {client.balance > 0 && (
                        <a
                          className="btn-whatsapp"
                          href={`https://wa.me/${client.phone}?text=${encodeURIComponent(
                            `Dear ${client.name}, gentle payment reminder from Rajput Plastics. Outstanding balance of ${rupee.format(
                              client.balance
                            )} is pending. Payment Terms: ${client.creditPeriodDays} days. Please settle at your earliest.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle size={14} /> Send Reminder
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Selected Client Profile & Interaction Timeline Drawer */}
      {selectedClient && (
        <div className="grid-2">
          {/* Client CRM Details & FIFO Aging */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>CRM Profile: {selectedClient.name}</h3>
                <p>Receivables aging, payment terms and credit profile</p>
              </div>
              <span className={`badge badge-${selectedClient.computedStatus === "active" ? "success" : "warning"}`}>
                {selectedClient.computedStatus.toUpperCase()}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Payment Terms:</span>
                <strong>{selectedClient.creditPeriodDays} Days</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Credit Limit:</span>
                <strong>{rupee.format(selectedClient.creditLimit)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Current Balance Due:</span>
                <strong style={{ color: selectedClient.balance > 0 ? "var(--danger)" : "var(--success)" }}>
                  {rupee.format(selectedClient.balance)}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--card-border)", paddingBottom: "0.4rem" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Last Order Date:</span>
                <strong>{selectedClient.lastOrderDate || "No Orders Yet"}</strong>
              </div>
            </div>

            {/* FIFO Aging Breakdown */}
            <div style={{ background: "#f8fafc", padding: "1rem", borderRadius: "var(--radius-md)", border: "1px solid var(--card-border)", marginBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "0.75rem" }}>FIFO Receivables Aging Breakdown</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", textAlign: "center" }}>
                <div style={{ background: "#ffffff", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>0-30 DAYS</div>
                  <strong style={{ fontSize: "0.9rem" }}>{rupee.format(selectedClient.aging.bucket0_30)}</strong>
                </div>
                <div style={{ background: "#ffffff", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--warning)", fontWeight: 700 }}>31-60 DAYS</div>
                  <strong style={{ fontSize: "0.9rem", color: "var(--warning)" }}>{rupee.format(selectedClient.aging.bucket31_60)}</strong>
                </div>
                <div style={{ background: "#ffffff", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--danger)", fontWeight: 700 }}>61-90 DAYS</div>
                  <strong style={{ fontSize: "0.9rem", color: "var(--danger)" }}>{rupee.format(selectedClient.aging.bucket61_90)}</strong>
                </div>
                <div style={{ background: "#ffffff", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "0.68rem", color: "#991b1b", fontWeight: 700 }}>90+ DAYS</div>
                  <strong style={{ fontSize: "0.9rem", color: "#991b1b" }}>{rupee.format(selectedClient.aging.bucket90Plus)}</strong>
                </div>
              </div>
            </div>

            {/* Schedule Follow-up Form */}
            {!isReadOnly && (
              <form onSubmit={handleCreateFollowUp} className="form-panel" style={{ marginTop: "1rem" }}>
                <h4 style={{ fontSize: "0.88rem", fontWeight: 700 }}>Schedule Next Follow-Up Task</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      required
                      className="form-control"
                      value={followUpForm.dueDate}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, dueDate: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Task Reason / Purpose *</label>
                    <input
                      type="text"
                      required
                      className="form-control"
                      placeholder="e.g. Call for payment release"
                      value={followUpForm.reason}
                      onChange={(e) => setFollowUpForm({ ...followUpForm, reason: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-outline btn-sm" style={{ alignSelf: "flex-end" }}>
                  <Clock size={14} /> Schedule Task
                </button>
              </form>
            )}
          </div>

          {/* Interaction Timeline Log */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Interaction History ({interactions.length})</h3>
                <p>Newest-first conversation notes, calls & visit records</p>
              </div>
            </div>

            {/* Inline Add Interaction Form */}
            {!isReadOnly && (
              <form onSubmit={handleAddInteraction} className="form-panel" style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <select
                    className="form-control"
                    style={{ width: "120px" }}
                    value={interactionForm.type}
                    onChange={(e) => setInteractionForm({ ...interactionForm, type: e.target.value as InteractionType })}
                  >
                    <option value="call">Call</option>
                    <option value="visit">Visit</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="note">Note</option>
                  </select>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Log client call details or discussion summary..."
                    value={interactionForm.text}
                    onChange={(e) => setInteractionForm({ ...interactionForm, text: e.target.value })}
                  />
                  <button type="submit" className="btn-primary btn-sm">
                    <Send size={14} /> Log
                  </button>
                </div>
              </form>
            )}

            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "360px", overflowY: "auto" }}>
              {interactions.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem" }}>
                  No interaction records logged for this client yet.
                </p>
              ) : (
                interactions.map((int) => (
                  <div key={int.id} className="notice-item" style={{ margin: 0 }}>
                    <div className="notice-meta">
                      <span className="badge badge-teal" style={{ textTransform: "uppercase" }}>
                        {int.type}
                      </span>
                      <span>{new Date(int.timestamp).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: "0.25rem 0 0", color: "var(--text-main)", fontWeight: 500 }}>{int.text}</p>
                    <small style={{ color: "var(--text-muted)" }}>Logged by: {int.createdBy}</small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Add New Client Modal */}
      {showAddModal && (
        <div className="panel wide" style={{ border: "2px solid var(--primary)", marginTop: "1.5rem" }}>
          <div className="panel-header">
            <div className="panel-title">
              <h3>Create New Client / Customer Master</h3>
              <p>Register dealer, shopkeeper or direct buyer profile with credit terms</p>
            </div>
            <button className="btn-outline btn-sm" onClick={() => setShowAddModal(false)} type="button">
              Cancel
            </button>
          </div>

          {formError && (
            <div className="toast-badge" style={{ background: "var(--danger-bg)", color: "var(--danger)", border: "1px solid var(--danger-border)", marginBottom: "1rem" }}>
              <AlertTriangle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAddClient} className="form-panel">
            <div className="form-grid">
              <div className="form-group">
                <label>Client Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Rajasthan Traders & Co"
                  value={clientForm.name}
                  onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Phone Number (10 Digits) *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. 9829012345"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>WhatsApp Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 9829012345"
                  value={clientForm.whatsapp}
                  onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })}
                />
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. Jaipur"
                  value={clientForm.city}
                  onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>GSTIN (15-Char Format, Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 08AABCJ1020A1Z5"
                  value={clientForm.gstin}
                  onChange={(e) => setClientForm({ ...clientForm, gstin: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Client Category *</label>
                <select
                  className="form-control"
                  value={clientForm.clientCategory}
                  onChange={(e) => setClientForm({ ...clientForm, clientCategory: e.target.value as ClientCategory })}
                >
                  <option value="dealer">Dealer (Wholesale)</option>
                  <option value="retailer">Retailer (Shopkeeper)</option>
                  <option value="direct">Direct Industrial Buyer</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Credit Limit Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={clientForm.creditLimit}
                  onChange={(e) => setClientForm({ ...clientForm, creditLimit: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Payment Terms (Days)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={clientForm.payment_terms_days}
                  onChange={(e) => setClientForm({ ...clientForm, payment_terms_days: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Tags (Comma Separated)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. VIP, High Volume"
                  value={clientForm.tags}
                  onChange={(e) => setClientForm({ ...clientForm, tags: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Special Instructions / Client Notes</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Enter client delivery preferences or special payment arrangements..."
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                <Plus size={18} /> Register Client Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   7. DISPATCH VIEW
========================================================================= */
function DispatchView({
  dispatches,
  orders,
  parties,
  onCreateDispatch,
  onUpdateStatus,
}: {
  dispatches: Dispatch[];
  orders: Order[];
  parties: Party[];
  onCreateDispatch: (form: any) => void;
  onUpdateStatus: (id: string, status: any) => void;
}) {
  const openOrders = orders.filter((o) => o.status !== "delivered");
  const [form, setForm] = useState({
    orderId: openOrders[0]?.id ?? "",
    transportProvider: "Porter Express Logistics",
    trackingId: "",
    vehicleType: "Tata 407 (14 Ft Open)",
    cost: "1200",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.orderId || !form.transportProvider || !form.trackingId) return;

    onCreateDispatch({
      orderId: form.orderId,
      transportProvider: form.transportProvider,
      trackingId: form.trackingId,
      vehicleType: form.vehicleType,
      cost: Number(form.cost || 0),
    });

    setForm({
      orderId: openOrders[0]?.id ?? "",
      transportProvider: "Porter Express Logistics",
      trackingId: "",
      vehicleType: "Tata 407 (14 Ft Open)",
      cost: "1200",
    });
  };

  return (
    <div className="content-grid">
      <div className="grid-2">
        {/* Create Dispatch Form */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Create Vehicle Dispatch</h3>
              <p>Assign transport provider and vehicle tracking to client order</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-panel">
            <div className="form-group">
              <label>Select Ready Order *</label>
              <select
                className="form-control"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              >
                {openOrders.length === 0 ? (
                  <option value="">No pending orders ready for dispatch</option>
                ) : (
                  openOrders.map((o) => {
                    const party = parties.find((p) => p.id === o.partyId);
                    return (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber} · {party?.name} ({o.status})
                      </option>
                    );
                  })
                )}
              </select>
            </div>

            <div className="form-group">
              <label>Transporter Name *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Porter Logistics / VRL / Own Fleet"
                value={form.transportProvider}
                onChange={(e) => setForm({ ...form, transportProvider: e.target.value })}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Vehicle / Tracking # *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. RJ-14-GA-8821"
                  value={form.trackingId}
                  onChange={(e) => setForm({ ...form, trackingId: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Vehicle Type</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Pickup, Tata Ace, Truck"
                  value={form.vehicleType}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Freight / Transport Cost (₹)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={!form.orderId} style={{ width: "100%", justifyContent: "center" }}>
              <Truck size={18} /> Confirm Dispatch
            </button>
          </form>
        </div>

        {/* Active Shipments Register */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>Live Shipments Tracker</h3>
              <p>Update delivery pipeline status</p>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order / Client</th>
                  <th>Tracking #</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {dispatches.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.partyName}</strong>
                      <br />
                      <small>{d.orderNumber}</small>
                    </td>
                    <td><code>{d.trackingId}</code></td>
                    <td>{rupee.format(d.cost)}</td>
                    <td>
                      <span className={`badge badge-${d.status === "delivered" ? "success" : d.status === "in_transit" ? "warning" : "info"}`}>
                        {d.status.replace("_", " ").toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {d.status === "dispatched" && (
                        <button className="btn-outline btn-sm" onClick={() => onUpdateStatus(d.id, "in_transit")}>
                          Mark In-Transit
                        </button>
                      )}
                      {d.status === "in_transit" && (
                        <button className="btn-primary btn-sm" onClick={() => onUpdateStatus(d.id, "delivered")}>
                          Mark Delivered
                        </button>
                      )}
                      {d.status === "delivered" && <span>✓ Delivered</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   8. REPORTS & ANALYTICS VIEW
========================================================================= */
function ReportsView({
  entries,
  products,
  materials,
  boms,
  onExport,
}: {
  entries: ProductionEntry[];
  products: Product[];
  materials: Material[];
  boms: Bom[];
  onExport: () => void;
}) {
  const consumptionMap = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const bom = boms.find((b) => b.id === e.bomId);
      bom?.lineItems.forEach((line) => {
        map.set(line.materialId, (map.get(line.materialId) ?? 0) + line.qtyPerUnit * e.quantityProduced);
      });
    });
    return map;
  }, [boms, entries]);

  return (
    <div className="content-grid">
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Production Audit Summary ({entries.length} Total Runs)</h3>
            <p>Historical production entries and machine downtime logs</p>
          </div>
          <button className="btn-primary" onClick={onExport}>
            <Download size={18} /> Export Production CSV
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product</th>
                <th>Output Qty</th>
                <th>Rejected</th>
                <th>Shift</th>
                <th>Machine</th>
                <th>Downtime</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const prod = products.find((p) => p.id === e.productId);
                return (
                  <tr key={e.id}>
                    <td>{e.entryDate}</td>
                    <td><strong>{prod?.name}</strong></td>
                    <td><strong style={{ color: "var(--success)" }}>{e.quantityProduced} {prod?.unit}</strong></td>
                    <td>{e.quantityRejected > 0 ? <span className="badge badge-danger">{e.quantityRejected}</span> : "-"}</td>
                    <td>{e.shift}</td>
                    <td><small>{e.machineId}</small></td>
                    <td>{e.downtimeMinutes > 0 ? `${e.downtimeMinutes}m` : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Cumulative Raw Material Consumption</h3>
            <p>Total raw materials utilized in production batches</p>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Material Name</th>
                <th>Category</th>
                <th>Consumed Quantity</th>
                <th>Current Stock Remaining</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const consumed = consumptionMap.get(m.id) ?? 0;
                return (
                  <tr key={m.id}>
                    <td><code>{m.code}</code></td>
                    <td><strong>{m.name}</strong></td>
                    <td><span className="badge badge-purple">{m.category}</span></td>
                    <td><strong style={{ color: "var(--primary)" }}>{consumed.toFixed(2)} {m.unit}</strong></td>
                    <td>{m.currentStock} {m.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   9. NOTICES & BULLETINS VIEW
========================================================================= */
function NoticesView({
  notices,
  onAddNotice,
}: {
  notices: PlantNotice[];
  onAddNotice: (n: PlantNotice) => void;
}) {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    targetShift: "All Shifts" as PlantNotice["targetShift"],
    priority: "High" as PlantNotice["priority"],
    issuedBy: "Plant Operations Manager",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;

    onAddNotice({
      id: createId("not"),
      title: form.title,
      content: form.content,
      targetShift: form.targetShift,
      priority: form.priority,
      date: today,
      issuedBy: form.issuedBy,
    });

    setShowModal(false);
    setForm({
      title: "",
      content: "",
      targetShift: "All Shifts",
      priority: "High",
      issuedBy: "Plant Operations Manager",
    });
  };

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Plant Bulletins & Shift Handover Notices</h3>
            <p>Maintenance, quality and shift announcements across all lines</p>
          </div>
          <button className="btn-primary" onClick={() => setShowModal(!showModal)}>
            <Plus size={18} /> Broadcast New Bulletin
          </button>
        </div>

        <div>
          {notices.map((n) => (
            <div key={n.id} className={`notice-item ${n.priority.toLowerCase()}`} style={{ padding: "1.25rem" }}>
              <div className="notice-meta" style={{ marginBottom: "0.4rem" }}>
                <span><strong>{n.issuedBy}</strong> · Target: <span className="badge badge-teal">{n.targetShift}</span></span>
                <span>{n.date} · <span className={`badge badge-${n.priority === "Urgent" ? "danger" : "warning"}`}>{n.priority} Priority</span></span>
              </div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>{n.title}</h3>
              <p style={{ fontSize: "0.88rem", lineHeight: "1.5" }}>{n.content}</p>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="panel" style={{ border: "2px solid var(--primary)", marginTop: "1.5rem" }}>
          <div className="panel-header">
            <div className="panel-title">
              <h3>Broadcast New Plant Bulletin</h3>
              <p>Publish an announcement to operators, maintenance, or shift teams</p>
            </div>
            <button className="btn-outline btn-sm" onClick={() => setShowModal(false)}>Close</button>
          </div>

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Bulletin Title *</label>
              <input
                type="text"
                required
                className="form-control"
                placeholder="e.g. Preventative Maintenance Scheduled for Line 1"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Target Audience / Shift</label>
              <select
                className="form-control"
                value={form.targetShift}
                onChange={(e) => setForm({ ...form, targetShift: e.target.value as any })}
              >
                <option value="All Shifts">All Shifts (Plant Wide)</option>
                <option value="Morning Shift">Morning Shift Only</option>
                <option value="Maintenance Team">Maintenance Engineers</option>
                <option value="Quality Dept">Quality Assurance Dept</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority Level</label>
              <select
                className="form-control"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
              >
                <option value="Urgent">Urgent (Plant Action Required)</option>
                <option value="High">High Priority</option>
                <option value="Normal">Normal Information</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label>Bulletin Content *</label>
              <textarea
                required
                rows={4}
                className="form-control"
                placeholder="Write detailed bulletin instructions here..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn-primary"><Send size={18} /> Broadcast Bulletin</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/* =========================================================================
   10. SETUP & BOM BUILDER VIEW (OWNER ONLY)
========================================================================= */
function SetupView({
  products,
  materials,
  boms,
  onProductCreated,
  onMaterialCreated,
  onBomSaved,
  showToast,
}: {
  products: Product[];
  materials: Material[];
  boms: Bom[];
  onProductCreated: (p: Product) => void;
  onMaterialCreated: (m: Material) => void;
  onBomSaved: (b: Bom) => void;
  showToast: (msg: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"products" | "materials" | "bom">("products");
  const [editingProductId, setEditingProductId] = useState<string>(products[0]?.id ?? "");

  // Form states for Add Product
  const [productForm, setProductForm] = useState({
    name: "",
    unit: "pcs",
    daily_target: "",
    sellingPrice: "",
  });

  // Form states for Add Material
  const [materialForm, setMaterialForm] = useState({
    name: "",
    unit: "kg",
    low_stock_threshold: "50",
    current_stock: "100",
    unitCost: "",
  });

  // BOM Builder State
  const activeBomForProduct = useMemo(
    () => boms.find((b) => b.productId === editingProductId && b.isActive),
    [boms, editingProductId]
  );

  const [bomLines, setBomLines] = useState<BomLineItem[]>(() => activeBomForProduct?.lineItems || []);

  // Sync bomLines when editingProductId changes
  const handleSelectProductForBom = (productId: string) => {
    setEditingProductId(productId);
    const active = boms.find((b) => b.productId === productId && b.isActive);
    setBomLines(active?.lineItems ? [...active.lineItems] : []);
    setActiveTab("bom");
  };

  // Create Product handler
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.unit) return;

    const newProd = dataService.createProduct({
      name: productForm.name,
      unit: productForm.unit,
      daily_target: Number(productForm.daily_target || 0),
      sellingPrice: Number(productForm.sellingPrice || 0),
    });

    onProductCreated(newProd);
    showToast(`✓ Added Product "${newProd.name}". You can now build its BOM.`);
    setProductForm({ name: "", unit: "pcs", daily_target: "", sellingPrice: "" });
  };

  // Create Material handler
  const handleAddMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialForm.name || !materialForm.unit) return;

    const newMat = dataService.createMaterial({
      name: materialForm.name,
      unit: materialForm.unit,
      low_stock_threshold: Number(materialForm.low_stock_threshold || 0),
      current_stock: Number(materialForm.current_stock || 0),
      unitCost: Number(materialForm.unitCost || 0),
    });

    onMaterialCreated(newMat);
    showToast(`✓ Added Material "${newMat.name}" with starting stock ${newMat.currentStock} ${newMat.unit}.`);
    setMaterialForm({ name: "", unit: "kg", low_stock_threshold: "50", current_stock: "100", unitCost: "" });
  };

  // Add line to BOM Builder
  const handleAddBomLine = () => {
    const firstMat = materials[0];
    if (!firstMat) {
      showToast("Create raw materials first before adding to BOM!");
      return;
    }
    setBomLines([...bomLines, { materialId: firstMat.id, qtyPerUnit: 1 }]);
  };

  // Remove line from BOM Builder
  const handleRemoveBomLine = (index: number) => {
    setBomLines(bomLines.filter((_, idx) => idx !== index));
  };

  // Save new BOM version
  const handleSaveBom = () => {
    if (!editingProductId) {
      showToast("Select a product to save BOM.");
      return;
    }

    const validLines = bomLines.filter((line) => line.materialId && line.qtyPerUnit > 0);
    const newBom = dataService.saveBom(editingProductId, validLines);

    onBomSaved(newBom);
    const prod = products.find((p) => p.id === editingProductId);
    showToast(`✓ Created BOM v${newBom.version} for ${prod?.name || "Product"}. Previous versions preserved.`);
  };

  const selectedProduct = products.find((p) => p.id === editingProductId);

  return (
    <div className="content-grid">
      {/* Sub Tabs */}
      <div className="panel wide">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Owner Master Setup Portal</h3>
            <p>Define product catalog, raw materials & immutable BOM recipe versions</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className={activeTab === "products" ? "btn-primary" : "btn-outline"}
              onClick={() => setActiveTab("products")}
              type="button"
            >
              Products Catalog ({products.length})
            </button>
            <button
              className={activeTab === "materials" ? "btn-primary" : "btn-outline"}
              onClick={() => setActiveTab("materials")}
              type="button"
            >
              Raw Materials ({materials.length})
            </button>
            <button
              className={activeTab === "bom" ? "btn-primary" : "btn-outline"}
              onClick={() => setActiveTab("bom")}
              type="button"
            >
              BOM Builder Engine
            </button>
          </div>
        </div>
      </div>

      {/* PRODUCTS TAB */}
      {activeTab === "products" && (
        <div className="grid-2">
          {/* Add Product Form */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Add New Product</h3>
                <p>Register a manufactured item into master catalog</p>
              </div>
            </div>

            <form onSubmit={handleAddProduct} className="form-panel">
              <div className="form-group">
                <label>Product Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. 500ml Plastic Water Container"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="pcs, boxes, sets, kg"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Daily Production Target (optional)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 500"
                    value={productForm.daily_target}
                    onChange={(e) => setProductForm({ ...productForm, daily_target: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Selling Price per Unit (₹)</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  placeholder="e.g. 350"
                  value={productForm.sellingPrice}
                  onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
                <Plus size={18} /> Add Product to Catalog
              </button>
            </form>
          </div>

          {/* Product Directory */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Product Directory</h3>
                <p>Existing products and their active BOM versions</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Unit</th>
                    <th>Daily Target</th>
                    <th>Active BOM</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const activeBom = boms.find((b) => b.productId === p.id && b.isActive);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.name}</strong>
                          <br />
                          <small>{p.code}</small>
                        </td>
                        <td>{p.unit}</td>
                        <td>{p.dailyTarget > 0 ? `${p.dailyTarget} ${p.unit}` : "-"}</td>
                        <td>
                          {activeBom ? (
                            <span className="badge badge-success">BOM v{activeBom.version}</span>
                          ) : (
                            <span className="badge badge-warning">No Active BOM</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-outline btn-sm"
                            onClick={() => handleSelectProductForBom(p.id)}
                            type="button"
                          >
                            <Layers3 size={14} /> Edit BOM
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MATERIALS TAB */}
      {activeTab === "materials" && (
        <div className="grid-2">
          {/* Add Material Form */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Add New Raw Material</h3>
                <p>Register raw materials, color additives or packaging stock</p>
              </div>
            </div>

            <form onSubmit={handleAddMaterial} className="form-panel">
              <div className="form-group">
                <label>Material Name *</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="e.g. HDPE Resin Granules Grade 5502"
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="kg, pcs, liters, rolls"
                    value={materialForm.unit}
                    onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Low Stock Alert Threshold *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-control"
                    placeholder="e.g. 100"
                    value={materialForm.low_stock_threshold}
                    onChange={(e) => setMaterialForm({ ...materialForm, low_stock_threshold: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Starting Current Stock *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="form-control"
                    placeholder="e.g. 500"
                    value={materialForm.current_stock}
                    onChange={(e) => setMaterialForm({ ...materialForm, current_stock: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Unit Purchase Cost (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 120"
                    value={materialForm.unitCost}
                    onChange={(e) => setMaterialForm({ ...materialForm, unitCost: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
                <Plus size={18} /> Add Material to Inventory
              </button>
            </form>
          </div>

          {/* Material Directory */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <h3>Raw Material Inventory Master</h3>
                <p>Master list of materials and current stock levels</p>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Material Name</th>
                    <th>Unit</th>
                    <th>Current Stock</th>
                    <th>Low Threshold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const isLow = m.currentStock <= m.lowStockThreshold;
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.name}</strong>
                          <br />
                          <small>{m.code}</small>
                        </td>
                        <td>{m.unit}</td>
                        <td><strong>{m.currentStock} {m.unit}</strong></td>
                        <td>{m.lowStockThreshold} {m.unit}</td>
                        <td>
                          <span className={`badge badge-${isLow ? "danger" : "success"}`}>
                            {isLow ? "Low Stock" : "Healthy"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BOM BUILDER TAB */}
      {activeTab === "bom" && (
        <div className="panel wide">
          <div className="panel-header">
            <div className="panel-title">
              <h3>BOM Version Builder Engine</h3>
              <p>Formulate raw material requirements for product pieces. Saves create a new active version and preserve history!</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <div className="form-group" style={{ flex: 1, minWidth: "260px" }}>
              <label>Select Product to Build / Edit BOM</label>
              <select
                className="form-control"
                value={editingProductId}
                onChange={(e) => handleSelectProductForBom(e.target.value)}
              >
                {products.map((p) => {
                  const active = boms.find((b) => b.productId === p.id && b.isActive);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — {active ? `Active BOM v${active.version}` : "No Active BOM"}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedProduct && (
              <div style={{ background: "var(--primary-light)", padding: "0.85rem 1.25rem", borderRadius: "var(--radius-md)", alignSelf: "flex-end" }}>
                Target Product: <strong>{selectedProduct.name}</strong> | Active Version: <strong>v{activeBomForProduct?.version ?? 0}</strong>
              </div>
            )}
          </div>

          {/* BOM Line Items Editor Table */}
          <div className="table-container" style={{ marginBottom: "1.25rem" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Raw Material</th>
                  <th>Required Qty per 1 {selectedProduct?.unit || "Unit"}</th>
                  <th>Material Unit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bomLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                      No raw material line items in this BOM yet. Click <strong>"Add Material Line"</strong> below to start building the formulation.
                    </td>
                  </tr>
                ) : (
                  bomLines.map((line, idx) => {
                    const selectedMat = materials.find((m) => m.id === line.materialId);

                    return (
                      <tr key={idx}>
                        <td><strong>#{idx + 1}</strong></td>
                        <td>
                          <select
                            className="form-control"
                            value={line.materialId}
                            onChange={(e) => {
                              const updated = [...bomLines];
                              updated[idx].materialId = e.target.value;
                              setBomLines(updated);
                            }}
                          >
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.code}) — Stock: {m.currentStock} {m.unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            className="form-control"
                            style={{ width: "160px" }}
                            placeholder="Qty per unit"
                            value={line.qtyPerUnit}
                            onChange={(e) => {
                              const updated = [...bomLines];
                              updated[idx].qtyPerUnit = Number(e.target.value);
                              setBomLines(updated);
                            }}
                          />
                        </td>
                        <td><span className="badge badge-teal">{selectedMat?.unit || "-"}</span></td>
                        <td>
                          <button
                            className="btn-outline btn-sm"
                            style={{ color: "var(--danger)" }}
                            onClick={() => handleRemoveBomLine(idx)}
                            type="button"
                          >
                            <Trash2 size={14} /> Remove Line
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn-outline" onClick={handleAddBomLine} type="button">
              <Plus size={18} /> Add Material Line
            </button>

            <button className="btn-primary" onClick={handleSaveBom} type="button" disabled={bomLines.length === 0}>
              <CheckCircle size={18} /> Save & Activate New BOM Version
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


/* =========================================================================
   WORK ORDERS VIEW — Blueprint Section 4 & 8.1
========================================================================= */
function WorkOrdersView({
  workOrders,
  products,
  machines,
  userRole,
  onStatusChange,
  showToast,
}: {
  workOrders: WorkOrder[];
  products: Product[];
  machines: Machine[];
  userRole: "owner" | "supervisor" | "ca";
  onStatusChange: (id: string, status: WorkOrderStatus) => void;
  showToast: (msg: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | "all">("all");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    productId: products[0]?.id ?? "",
    quantity: "",
    machineId: machines[0]?.id ?? "",
    dueDate: "",
    priority: "Normal" as "Urgent" | "High" | "Normal",
    notes: "",
  });

  const filtered = workOrders.filter((w) => filterStatus === "all" || w.status === filterStatus);

  const PIPELINE: WorkOrderStatus[] = ["Draft", "Released", "In Progress", "On Hold", "Completed", "Closed"];

  const statusBadge = (s: WorkOrderStatus) => {
    const map: Record<WorkOrderStatus, string> = {
      Draft: "badge-gray",
      Released: "badge-blue",
      "In Progress": "badge-green",
      "On Hold": "badge-orange",
      Completed: "badge-green",
      Closed: "badge-gray",
    };
    return map[s] ?? "badge-gray";
  };

  const nextStatus = (s: WorkOrderStatus): WorkOrderStatus | null => {
    const map: Partial<Record<WorkOrderStatus, WorkOrderStatus>> = {
      Draft: "Released",
      Released: "In Progress",
      "In Progress": "Completed",
      "On Hold": "In Progress",
      Completed: "Closed",
    };
    return map[s] ?? null;
  };

  const priorityBadge = (p: string) => {
    if (p === "Urgent") return "badge-danger";
    if (p === "High") return "badge-orange";
    return "badge-gray";
  };

  const handleCreateWorkOrder = () => {
    if (!newForm.productId || !newForm.quantity || !newForm.dueDate) {
      showToast("Fill in product, quantity and due date.");
      return;
    }
    const product = products.find((p) => p.id === newForm.productId);
    const woNum = `WO-${1000 + workOrders.length + 1}`;
    const wo: WorkOrder = {
      id: `wo-${Date.now()}`,
      workOrderNumber: woNum,
      orderNumber: woNum,
      productId: newForm.productId,
      quantityOrdered: Number(newForm.quantity),
      quantity: Number(newForm.quantity),
      quantityCompleted: 0,
      status: "Draft",
      assignedMachineId: newForm.machineId,
      assignedOperator: "Floor Operator",
      materialReadiness: "Not Allocated",
      stage: "Tooling Setup",
      priority: newForm.priority,
      dueDate: newForm.dueDate,
      notes: newForm.notes,
      createdAt: new Date().toISOString(),
      createdBy: "Supervisor",
    };
    // TODO: FIREBASE — Firestore transaction, update workOrders subcollection
    // TODO: SUPABASE (later) — INSERT INTO work_orders ...
    dataService.createWorkOrder(wo);
    onStatusChange(wo.id, wo.status); // triggers state refresh
    setShowNewForm(false);
    showToast(`✓ Work Order ${wo.orderNumber} created for ${product?.name}`);
  };


  return (
    <div className="content-grid">
      {/* Pipeline Summary Strip */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Work Order Pipeline</h3>
            <p>Track manufacturing jobs from Draft to Closed</p>
          </div>
          {userRole !== "ca" && (
            <button className="btn-primary" onClick={() => setShowNewForm(!showNewForm)}>
              <Plus size={16} /> New Work Order
            </button>
          )}
        </div>

        <div className="pipeline-steps" style={{ marginBottom: "1rem" }}>
          {PIPELINE.map((step) => {
            const count = workOrders.filter((w) => w.status === step).length;
            const isActive = filterStatus === step;
            return (
              <button
                key={step}
                className={`pipeline-step ${isActive ? "active" : count > 0 ? "" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setFilterStatus(isActive ? "all" : step)}
              >
                {step} {count > 0 && <strong>({count})</strong>}
              </button>
            );
          })}
          <button
            className={`pipeline-step ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All ({workOrders.length})
          </button>
        </div>

        {/* New Work Order Form */}
        {showNewForm && (
          <div style={{ background: "#F8FAFC", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: "1.15rem", marginBottom: "1rem" }}>
            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, marginBottom: "0.75rem" }}>Create New Work Order</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Product</label>
                <select className="form-control" value={newForm.productId} onChange={(e) => setNewForm({ ...newForm, productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target Quantity</label>
                <input type="number" className="form-control" value={newForm.quantity} onChange={(e) => setNewForm({ ...newForm, quantity: e.target.value })} placeholder="e.g. 500" />
              </div>
              <div className="form-group">
                <label>Assign Machine</label>
                <select className="form-control" value={newForm.machineId} onChange={(e) => setNewForm({ ...newForm, machineId: e.target.value })}>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name} [{m.status}]</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input type="date" className="form-control" value={newForm.dueDate} onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select className="form-control" value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value as any })}>
                  <option value="Normal">Normal</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" className="form-control" value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.85rem" }}>
              <button className="btn-primary" onClick={handleCreateWorkOrder}><CheckCircle size={16} /> Create Work Order</button>
              <button className="btn-outline" onClick={() => setShowNewForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Work Orders Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>WO #</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Machine</th>
                <th>Priority</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No work orders found.</td></tr>
              ) : (
                filtered.map((wo) => {
                  const product = products.find((p) => p.id === wo.productId);
                  const machine = machines.find((m) => m.id === wo.assignedMachineId);
                  const next = nextStatus(wo.status);
                  const isOverdue = wo.dueDate < today && wo.status !== "Completed" && wo.status !== "Closed";
                  return (
                    <tr key={wo.id}>
                      <td><code>{wo.orderNumber}</code></td>
                      <td><strong>{product?.name ?? wo.productId}</strong></td>
                      <td>{wo.quantity.toLocaleString("en-IN")} {product?.unit}</td>
                      <td>{machine?.name ?? wo.assignedMachineId ?? "—"}</td>
                      <td><span className={`badge ${priorityBadge(wo.priority ?? "Normal")}`}>{wo.priority ?? "Normal"}</span></td>
                      <td>
                        <span style={{ color: isOverdue ? "var(--status-red)" : "inherit", fontWeight: isOverdue ? 700 : 500 }}>
                          {wo.dueDate}{isOverdue ? " ⚠" : ""}
                        </span>
                      </td>
                      <td><span className={`badge ${statusBadge(wo.status)}`}>{wo.status}</span></td>
                      <td>
                        {userRole !== "ca" && next && (
                          <button className="btn-outline btn-sm" onClick={() => onStatusChange(wo.id, next)}>
                            → {next}
                          </button>
                        )}
                        {userRole !== "ca" && wo.status === "In Progress" && (
                          <button className="btn-outline btn-sm" style={{ marginLeft: "0.4rem", color: "var(--status-orange)" }}
                            onClick={() => onStatusChange(wo.id, "On Hold")}>
                            Hold
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MACHINES VIEW — Blueprint Section 8.2
========================================================================= */
function MachinesView({
  machines,
  breakdownTickets,
  onReportBreakdown,
  onResolveBreakdown,
  showToast,
}: {
  machines: Machine[];
  breakdownTickets: BreakdownTicket[];
  onReportBreakdown: (data: { machineId: string; symptom: string; severity: "Urgent" | "High" | "Normal" }) => void;
  onResolveBreakdown: (ticketId: string) => void;
  showToast: (msg: string) => void;
}) {
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [bdForm, setBdForm] = useState({
    machineId: machines[0]?.id ?? "",
    symptom: "",
    severity: "Normal" as "Urgent" | "High" | "Normal",
  });

  // Breakdown rows first, then Idle, then Maintenance, then Running
  const sortedMachines = [...machines].sort((a, b) => {
    const order: Record<string, number> = { Breakdown: 0, Idle: 1, Maintenance: 2, Running: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const statusBadge = (s: Machine["status"]) => {
    const map: Record<Machine["status"], string> = {
      Running: "badge-green",
      Idle: "badge-orange",
      Breakdown: "badge-danger",
      Maintenance: "badge-blue",
    };
    return map[s] ?? "badge-gray";
  };

  const openTickets = breakdownTickets.filter((t) => t.status === "Open");

  const handleSubmitBreakdown = () => {
    if (!bdForm.machineId || !bdForm.symptom) {
      showToast("Select machine and describe the symptom.");
      return;
    }
    onReportBreakdown(bdForm);
    setShowBreakdownModal(false);
    setBdForm({ machineId: machines[0]?.id ?? "", symptom: "", severity: "Normal" });
  };

  return (
    <div className="content-grid">
      {/* Stats Strip */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon-box green"><Cpu size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Running</span>
            <span className="metric-value">{machines.filter((m) => m.status === "Running").length}</span>
            <span className="metric-sub">of {machines.length} total machines</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box orange"><Clock size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Idle</span>
            <span className="metric-value">{machines.filter((m) => m.status === "Idle").length}</span>
            <span className="metric-sub">Awaiting assignment</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box red"><AlertTriangle size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Breakdown</span>
            <span className="metric-value">{machines.filter((m) => m.status === "Breakdown").length}</span>
            <span className="metric-sub">{openTickets.length} open tickets</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box blue"><Wrench size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Maintenance</span>
            <span className="metric-value">{machines.filter((m) => m.status === "Maintenance").length}</span>
            <span className="metric-sub">Scheduled PM</span>
          </div>
        </div>
      </div>

      {/* Machine Table — Breakdown rows first */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Machine Status Board</h3>
            <p>Breakdowns surfaced first · Click "Report Breakdown" to raise a ticket</p>
          </div>
          <button className="btn-danger btn-sm" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }} onClick={() => setShowBreakdownModal(true)}>
            <AlertTriangle size={15} /> Report Breakdown
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Code</th>
                <th>Type / Location</th>
                <th>Status</th>
                <th>Operator</th>
                <th>Runtime (hrs)</th>
                <th>Next PM</th>
                <th>Open Tickets</th>
              </tr>
            </thead>
            <tbody>
              {sortedMachines.map((m) => {
                const tickets = breakdownTickets.filter((t) => t.machineId === m.id && t.status === "Open");
                return (
                  <tr key={m.id} className={m.status === "Breakdown" ? "row-breakdown" : ""}>
                    <td><strong>{m.name}</strong></td>
                    <td><code>{m.code}</code></td>
                    <td>{m.type} · {m.location}</td>
                    <td>
                      <span className={`badge ${statusBadge(m.status)}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>{m.currentOperator ?? <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                    <td>{m.runtimeHours ?? "—"} hrs</td>
                    <td>{m.nextMaintenanceDate ?? "—"}</td>
                    <td>
                      {tickets.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {tickets.map((t) => (
                            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span className={`badge badge-${t.severity === "Urgent" ? "danger" : t.severity === "High" ? "orange" : "gray"}`}>{t.severity}</span>
                              <span style={{ fontSize: "0.76rem" }}>{t.symptom}</span>
                              <button className="btn-outline btn-sm" style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem" }}
                                onClick={() => onResolveBreakdown(t.id)}>✓ Resolve</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>None</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown Modal */}
      {showBreakdownModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(2,16,36,0.5)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", padding: "1.75rem", width: "460px", maxWidth: "95vw", boxShadow: "var(--shadow-md)" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, marginBottom: "1.15rem", color: "var(--status-red)" }}>
              ⚠ Report Machine Breakdown
            </h3>
            <div className="form-panel">
              <div className="form-group">
                <label>Machine</label>
                <select className="form-control" value={bdForm.machineId} onChange={(e) => setBdForm({ ...bdForm, machineId: e.target.value })}>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name} [{m.status}]</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Symptom / Description</label>
                <input type="text" className="form-control" value={bdForm.symptom}
                  onChange={(e) => setBdForm({ ...bdForm, symptom: e.target.value })}
                  placeholder="e.g. Hydraulic oil leak on left cylinder" />
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select className="form-control" value={bdForm.severity} onChange={(e) => setBdForm({ ...bdForm, severity: e.target.value as any })}>
                  <option value="Normal">Normal — Can wait till shift end</option>
                  <option value="High">High — Fix within 2 hours</option>
                  <option value="Urgent">Urgent — Production stopped NOW</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.15rem" }}>
              <button className="btn-danger" onClick={handleSubmitBreakdown}><AlertTriangle size={15} /> Submit Breakdown Report</button>
              <button className="btn-outline" onClick={() => setShowBreakdownModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   QUALITY CONTROL VIEW — Blueprint Section 4
========================================================================= */
function QualityControlView({
  qcInspections,
  products,
  onRecordInspection,
  showToast,
}: {
  qcInspections: QcInspection[];
  products: Product[];
  onRecordInspection: (data: {
    batchNumber: string;
    productId: string;
    inspectedQty: number;
    passedQty: number;
    rejectedQty: number;
    defectCode: string;
    notes: string;
    inspector: string;
  }) => void;
  showToast: (msg: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    batchNumber: "",
    productId: products[0]?.id ?? "",
    inspectedQty: "",
    passedQty: "",
    rejectedQty: "0",
    defectCode: "",
    notes: "",
    inspector: "QC Inspector",
  });

  const statusBadge = (s: QcInspectionStatus) => {
    const map: Record<QcInspectionStatus, string> = {
      Passed: "badge-green",
      "On Hold": "badge-orange",
      Rejected: "badge-danger",
      Pending: "badge-blue",
    };
    return map[s] ?? "badge-gray";
  };

  const onHoldOrRejected = qcInspections.filter((q) => q.status === "On Hold" || q.status === "Rejected");
  const passed = qcInspections.filter((q) => q.status === "Passed").length;
  const pending = qcInspections.filter((q) => q.status === "Pending").length;
  const totalRejectedQty = qcInspections.reduce((sum, q) => sum + q.rejectedQty, 0);

  const handleSubmit = () => {
    if (!form.batchNumber || !form.productId || !form.inspectedQty || !form.passedQty) {
      showToast("Fill in batch #, product, and quantities.");
      return;
    }
    const inspected = Number(form.inspectedQty);
    const passedQty = Number(form.passedQty);
    const rejectedQty = Number(form.rejectedQty);
    if (passedQty + rejectedQty > inspected) {
      showToast("Passed + Rejected cannot exceed Inspected quantity.");
      return;
    }
    onRecordInspection({
      batchNumber: form.batchNumber,
      productId: form.productId,
      inspectedQty: inspected,
      passedQty,
      rejectedQty,
      defectCode: form.defectCode,
      notes: form.notes,
      inspector: form.inspector,
    });
    setShowForm(false);
    setForm({ batchNumber: "", productId: products[0]?.id ?? "", inspectedQty: "", passedQty: "", rejectedQty: "0", defectCode: "", notes: "", inspector: "QC Inspector" });
  };

  return (
    <div className="content-grid">
      {/* KPI Strip */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon-box green"><ShieldCheck size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Passed</span>
            <span className="metric-value">{passed}</span>
            <span className="metric-sub">Lots cleared for dispatch</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box blue"><History size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Pending</span>
            <span className="metric-value">{pending}</span>
            <span className="metric-sub">Awaiting inspection</span>
          </div>
        </div>
        <div className="metric-card">
          <div className={`metric-icon-box ${onHoldOrRejected.length > 0 ? "red" : "green"}`}><ShieldAlert size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">On Hold / Rejected</span>
            <span className="metric-value">{onHoldOrRejected.length}</span>
            <span className="metric-sub">Cannot dispatch — QC Hold active</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon-box orange"><AlertTriangle size={24} /></div>
          <div className="metric-data">
            <span className="metric-label">Total Rejected Units</span>
            <span className="metric-value">{totalRejectedQty.toLocaleString("en-IN")}</span>
            <span className="metric-sub">Across all inspections</span>
          </div>
        </div>
      </div>

      {/* Active Blockers */}
      {onHoldOrRejected.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <h3>⛔ Active QC Blockers</h3>
              <p>These lots cannot be dispatched until QC is cleared</p>
            </div>
          </div>
          {onHoldOrRejected.map((q) => {
            const product = products.find((p) => p.id === q.productId);
            return (
              <div key={q.id} className="blocker-alert" style={{ marginBottom: "0.5rem" }}>
                <ShieldAlert size={16} />
                <strong>Batch {q.batchNumber}</strong> — {product?.name} — {q.rejectedQty} units rejected
                {q.defectCode && <> · Defect: <code>{q.defectCode}</code></>}
                <span className={`badge ${statusBadge(q.status)}`} style={{ marginLeft: "auto" }}>{q.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection Table */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Inspection Queue</h3>
            <p>All QC inspection records — newest first</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={16} /> Record Inspection
          </button>
        </div>

        {/* New Inspection Form */}
        {showForm && (
          <div style={{ background: "#F8FAFC", border: "1px solid var(--card-border)", borderRadius: "var(--radius-md)", padding: "1.15rem", marginBottom: "1rem" }}>
            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, marginBottom: "0.75rem" }}>New QC Inspection Entry</h4>
            <div className="form-grid">
              <div className="form-group">
                <label>Batch Number</label>
                <input type="text" className="form-control" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} placeholder="e.g. BATCH-001" />
              </div>
              <div className="form-group">
                <label>Product</label>
                <select className="form-control" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Inspected Qty</label>
                <input type="number" className="form-control" value={form.inspectedQty} onChange={(e) => setForm({ ...form, inspectedQty: e.target.value })} placeholder="Total inspected" />
              </div>
              <div className="form-group">
                <label>Passed Qty</label>
                <input type="number" className="form-control" value={form.passedQty} onChange={(e) => setForm({ ...form, passedQty: e.target.value })} placeholder="Qty passed" />
              </div>
              <div className="form-group">
                <label>Rejected Qty</label>
                <input type="number" className="form-control" value={form.rejectedQty} onChange={(e) => setForm({ ...form, rejectedQty: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Defect Code</label>
                <input type="text" className="form-control" value={form.defectCode} onChange={(e) => setForm({ ...form, defectCode: e.target.value })} placeholder="e.g. WARPAGE-01" />
              </div>
              <div className="form-group">
                <label>Inspector Name</label>
                <input type="text" className="form-control" value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input type="text" className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.85rem" }}>
              <button className="btn-primary" onClick={handleSubmit}><CheckCircle size={16} /> Record Inspection</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Batch #</th>
                <th>Product</th>
                <th>Inspected</th>
                <th>Passed</th>
                <th>Rejected</th>
                <th>Defect Code</th>
                <th>Status</th>
                <th>Inspector</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {qcInspections.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No inspections recorded yet.</td></tr>
              ) : (
                qcInspections.map((q) => {
                  const product = products.find((p) => p.id === q.productId);
                  return (
                    <tr key={q.id}>
                      <td><code>{q.batchNumber}</code></td>
                      <td>{product?.name ?? q.productId}</td>
                      <td>{q.inspectedQty}</td>
                      <td style={{ color: "var(--status-green)", fontWeight: 700 }}>{q.passedQty}</td>
                      <td style={{ color: q.rejectedQty > 0 ? "var(--status-red)" : "inherit", fontWeight: q.rejectedQty > 0 ? 700 : 500 }}>{q.rejectedQty}</td>
                      <td>{q.defectCode ? <code>{q.defectCode}</code> : "—"}</td>
                      <td><span className={`badge ${statusBadge(q.status)}`}>{q.status}</span></td>
                      <td>{q.inspector}</td>
                      <td>{q.inspectedAt ? q.inspectedAt.slice(0, 10) : "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
