export type User = {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  jobPosition: string;
  joinDate: string;
  role: string;
  createdAt: string;
};

/** One entry per workspace member — a flat org chart, not a nested tree. */
export type HierarchyPerson = {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  jobPosition: string;
  role: string;
  joinDate: string;
  primaryManagerId: number | null;
  secondaryManagerIds: number[];
};

export type ProjectTask = {
  id: number;
  title: string;
  description?: string;
  dueDate?: string;
  priority?: "high" | "medium" | "low";
  status?: "pending" | "in_progress" | "completed" | "on_hold";
  progress?: number;
  assignedUsers?: Array<{ id: number; fullName: string }>;
};

export type ProjectHeading = {
  id: number;
  name: string;
  tasks: ProjectTask[];
  subHeadings: ProjectHeading[];
};

export type ProjectFile = {
  id: number;
  name: string;
  isFolder: boolean;
  type?: string;
  parentId?: number | null;
  size?: number | null;
  path?: string | null;
  version: string;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
  /** Set only on the main Documents page: true for the synthetic per-project
   * folder (not a real row — id is -projectId). */
  isProjectRoot?: boolean;
  /** Set only on the main Documents page: present on the synthetic project
   * folder and every file/folder mirrored from that project's Documents tab —
   * these are read-only there (no upload/new-folder/rename/delete). */
  projectId?: number;
};

export type Warehouse = {
  id: number;
  name: string;
  code?: string | null;
  location?: string | null;
  capacity: number;
  createdAt: string;
};

export type Vendor = {
  id: number;
  name: string;
  code?: string | null;
  location?: string | null;
  rating?: number | null;
  contractExpiryDate?: string | null;
  createdAt: string;
};

/** A shared item-name + code catalog entry, selectable from both the Inventory and Procurement "Add item" forms. */
export type CatalogItem = {
  id: number;
  name: string;
  code?: string | null;
  createdAt: string;
};

export type InventoryItem = {
  id: number;
  itemName: string;
  /** References the shared item catalog — null for rows created before catalog-linking existed (or via CSV import). */
  item?: { id: number; name: string; code?: string | null } | null;
  category: "hardware" | "software" | "service";
  quantity: number;
  unit?: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock";
  lastRestockedDate?: string | null;
  notes?: string | null;
  sku?: string | null;
  warehouse?: { id: number; name: string } | null;
  reservedQuantity: number;
  incomingQuantity: number;
  averageCost?: number | string | null;
  supplier?: string | null;
  vendor?: { id: number; name: string; code?: string | null; location?: string | null } | null;
  imageUrl?: string | null;
  warrantyExpiryDate?: string | null;
  updatedBy?: { id: number; fullName: string } | null;
  createdAt: string;
  /** Set only on the workspace-wide Inventory page (aggregated across projects). */
  projectId?: number;
  projectName?: string;
};

export type InventoryBatch = {
  id: number;
  batchNumber: string;
  quantity: number;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  createdAt: string;
};

export type InventorySerial = {
  id: number;
  serialNumber: string;
  status: "available" | "allocated" | "damaged" | "sold";
  warrantyExpiryDate?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type InventoryTransaction = {
  id: number;
  type: "receipt" | "issue" | "adjustment" | "transfer_in" | "transfer_out";
  quantityChange: number;
  resultingQuantity: number;
  reason?: string | null;
  performedBy?: { id: number; fullName: string } | null;
  /** Only present on the workspace-wide feed (GET /workspace/inventory/transactions). */
  inventoryItem?: { id: number; itemName: string };
  createdAt: string;
};

export type StockTransfer = {
  id: number;
  quantity: number;
  status: "pending" | "in_transit" | "completed" | "cancelled";
  notes?: string | null;
  fromWarehouse?: { id: number; name: string } | null;
  toWarehouse: { id: number; name: string };
  requestedBy?: { id: number; fullName: string } | null;
  createdAt: string;
  completedAt?: string | null;
};

export type InventoryAttachment = {
  id: number;
  fileName: string;
  filePath: string;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type InventoryItemDetail = {
  item: InventoryItem;
  batches: InventoryBatch[];
  serials: InventorySerial[];
  transactions: InventoryTransaction[];
  transfers: StockTransfer[];
  attachments: InventoryAttachment[];
  purchaseHistory: ProcurementItem[];
  projectAllocation: InventoryItem[];
};

export type ProcurementItem = {
  id: number;
  itemName: string;
  /** References the shared item catalog — null for rows created before catalog-linking existed (or via CSV import). */
  item?: { id: number; name: string; code?: string | null } | null;
  poNumber?: string | null;
  category: "hardware" | "software" | "service";
  quantity: number;
  estimatedCost?: number | string | null;
  unitCost?: number | string | null;
  vendorName?: string | null;
  vendor?: { id: number; name: string } | null;
  neededByDate?: string | null;
  status: "pending" | "approved" | "ordered" | "delivered";
  notes?: string | null;
  requestedBy?: { id: number; fullName: string } | null;
  createdAt: string;
  /** Set only on the workspace-wide Procurement page (aggregated across projects). */
  projectId?: number;
  projectName?: string;
};

export type ProcurementStatusHistory = {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  notes?: string | null;
  changedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type ProcurementAttachment = {
  id: number;
  fileName: string;
  filePath: string;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type ProcurementItemDetail = {
  item: ProcurementItem;
  statusHistory: ProcurementStatusHistory[];
  attachments: ProcurementAttachment[];
  projectAllocation: ProcurementItem[];
};

export type ReportKpi = {
  value: number;
  trendPct: number;
  sparkline: { date: string; value: number }[];
};

export type ReportSummary = {
  range: { start: string; end: string };
  kpis: {
    totalInventoryValue: ReportKpi;
    monthlyProcurementCost: ReportKpi;
    totalInventoryItems: ReportKpi;
    lowStockItems: ReportKpi;
    outOfStockItems: ReportKpi;
    activePurchaseOrders: ReportKpi;
    activeVendors: ReportKpi;
    inventoryTurnover: ReportKpi;
  };
  procurementCostTrend: { month: string; value: number }[];
  spendByCategory: { category: InventoryItem["category"]; value: number }[];
  inventoryValueByCategory: { category: InventoryItem["category"]; value: number }[];
  poStatusBreakdown: { status: ProcurementItem["status"]; count: number }[];
  warehouseUtilization: { id: number; name: string; used: number; capacity: number }[];
  stockMovementTrend: { month: string; receipt: number; issue: number; adjustment: number; transferred: number }[];
  topPurchasedItems: { id: number; itemName: string; value: number }[];
  projectMaterialConsumption: { projectName: string; value: number }[];
  inventoryAging: Record<string, number | string>[];
  vendorPerformance: { id: number; name: string; rating: number | null; avgDeliveryDays: number | null; purchaseVolume: number }[];
  deadStock: {
    id: number;
    itemName: string;
    sku: string | null;
    warehouse: string | null;
    quantity: number;
    value: number;
    daysSinceMovement: number;
    category: InventoryItem["category"];
    status: "Healthy" | "Slow Moving" | "Dead Stock" | "Critical";
    suggestedAction: string;
  }[];
  alerts: {
    delayedPOs: { id: number; itemName: string; neededByDate: string; vendorName: string | null }[];
    vendorDelays: { itemName: string; vendorName: string; neededByDate: string; deliveredAt: string }[];
    contractsExpiring: { id: number; name: string; contractExpiryDate: string }[];
    pendingAudits: unknown[];
  };
  insights: {
    inventoryValueTrendPct: number;
    procurementCostTrendPct: number;
    topVendorThisMonth: string | null;
    highestConsumingProject: string | null;
    lowestStockCategory: string | null;
  };
};

export type ReportActivity = {
  id: number;
  reportType: string;
  action: "viewed" | "exported";
  format?: string | null;
  performedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type ReportComment = {
  id: number;
  reportKey: string;
  body: string;
  createdBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type MonthlyPerformance = {
  id: number;
  year: number;
  /** 1-12 (January = 1). */
  month: number;
  contractEnergy?: number | string | null;
  actualGeneration?: number | string | null;
  incomeReceived?: number | string | null;
  monthlyExpenditure?: number | string | null;
  sparePartPurchase?: number | string | null;
  createdAt: string;
};

export type Project = {
  id: number;
  name: string;
  description?: string;
  progress?: number;
  tasksCount?: number;
  membersCount?: number;
  dueDate?: string;
  status: string;
  priority?: "high" | "medium" | "low";
  createdAt?: string;
  /** Date the client agreement was signed — Procurement tab financial summary. */
  contractDate?: string | null;
  /** Official project start date — Procurement tab financial summary. */
  kickoffDate?: string | null;
  /** Total estimated project budget — Procurement tab financial summary + budget bar denominator. */
  estimatedTotalCost?: number | string | null;
  /** Total contract value charged to the client — paired with estimatedTotalCost for profit margin. */
  sellingPrice?: number | string | null;
  assignees?: Array<{
    id: number;
    fullName: string;
    email?: string;
    role?: string;
    jobPosition?: string;
    phoneNumber?: string;
  }>;
  headings?: ProjectHeading[];
  files?: ProjectFile[];
  projectTasks?: ProjectTask[];
};
