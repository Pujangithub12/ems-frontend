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

/** One entry per organization member — a flat org chart, not a nested tree. */
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
  status?: "to_do" | "in_progress" | "completed" | "on_hold";
  progress?: number;
  assignedUsers?: Array<{ id: number; fullName: string }>;
  /** Gantt-nested children (Task.parentTaskId, set via the Schedule tab's
   * "add child task") — each child is also its own top-level entry in the
   * project's flattened task list, this is just a lightweight summary. */
  childTasks?: Array<{ id: number; title: string; status?: string; progress?: number }>;
  /** Set when this task is itself one of the above — a Gantt-nested child of
   * another task, not a top-level task. */
  parentTaskId?: number | null;
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
  /** The requesting user's resolved access on this node ("write" for
   * admin/super_admin always). Nodes the user can't see at all are already
   * filtered out server-side, so this only ever comes back "read" or "write". */
  myAccessLevel?: "none" | "read" | "write";
};

export type FileAccessGrant = {
  id: number;
  granteeType: "user" | "role";
  user?: { id: number; fullName: string; email: string } | null;
  role?: string;
  level: "none" | "read" | "write";
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
  contact?: string | null;
  contractExpiryDate?: string | null;
  /** Contact person's name at the vendor — distinct from `name`, which is the company name. Used on generated Purchase Order PDFs. */
  contactPerson?: string | null;
  /** Full postal address, for the generated Purchase Order PDF's "VENDOR" box — distinct from the shorter free-text `location`. */
  address?: string | null;
  email?: string | null;
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
  /** Set only on the organization-wide Inventory page (aggregated across projects). */
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
  /** Only present on the organization-wide feed (GET /organization/inventory/transactions). */
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

/** One row in the Inventory drawer's "Purchase History" section — a PurchaseOrderItem with the same item name, across the organization (procurement pipeline v2; replaces the old ProcurementItem-based lookup). */
export type InventoryPurchaseHistoryEntry = {
  id: number;
  itemName: string;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | string | null;
  purchaseOrder?: {
    id: number;
    poNumber?: string | null;
    status: string;
    vendor?: { id: number; name: string } | null;
    project?: { id: number; name: string } | null;
    createdAt: string;
  } | null;
};

export type InventoryItemDetail = {
  item: InventoryItem;
  batches: InventoryBatch[];
  serials: InventorySerial[];
  transactions: InventoryTransaction[];
  transfers: StockTransfer[];
  attachments: InventoryAttachment[];
  purchaseHistory: InventoryPurchaseHistoryEntry[];
  projectAllocation: InventoryItem[];
};

// ---------------------------------------------------------------------------
// Procurement pipeline v2: Purchase Request -> Vendor Selection -> Purchase
// Order -> Proforma Invoice -> Shipment/Insurance/Customs -> Cost Sheet ->
// Goods Receipt -> Inventory. Replaces the retired flat ProcurementItem model
// (old feature's pages/types have been removed along with it).
// ---------------------------------------------------------------------------

export type PurchaseRequestPriority = "low" | "medium" | "high" | "urgent";
export type PurchaseRequestStatus = "draft" | "submitted" | "approved" | "rejected" | "converted_to_po";
export type PurchaseRequestAttachmentType = "general" | "quotation" | "comparison_sheet";

export type PurchaseRequestItem = {
  id: number;
  itemName: string;
  item?: { id: number; name: string; code?: string | null } | null;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  estimatedPrice?: number | string | null;
  notes?: string | null;
};

export type VendorQuote = {
  id: number;
  price: number | string;
  notes?: string | null;
  isSelected: boolean;
  vendorId?: number | null;
  vendor?: Vendor | null;
  createdAt: string;
};

export type PurchaseRequestStatusHistoryEntry = {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  notes?: string | null;
  changedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type PurchaseRequestAttachment = {
  id: number;
  fileName: string;
  filePath: string;
  documentType: PurchaseRequestAttachmentType;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type PurchaseRequest = {
  id: number;
  prNumber?: string | null;
  department?: string | null;
  priority: PurchaseRequestPriority;
  reason?: string | null;
  status: PurchaseRequestStatus;
  requestedBy?: { id: number; fullName: string } | null;
  requestedById?: number | null;
  project?: { id: number; name: string } | null;
  projectId?: number;
  items: PurchaseRequestItem[];
  vendorQuotes: VendorQuote[];
  purchaseOrder?: { id: number; poNumber?: string | null; status: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseRequestDetail = {
  purchaseRequest: PurchaseRequest;
  statusHistory: PurchaseRequestStatusHistoryEntry[];
  attachments: PurchaseRequestAttachment[];
};

export type PurchaseOrderStatus = "created" | "sent" | "accepted" | "cancelled" | "completed";
export type PurchaseType = "local" | "international";

export type PurchaseOrderItem = {
  id: number;
  itemName: string;
  item?: { id: number; name: string; code?: string | null } | null;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | string | null;
  notes?: string | null;
  /** HS (Harmonized System) customs code for the PO PDF's line-item table — usually only filled in for international purchases. */
  hsnCode?: string | null;
};

export type PurchaseOrderAttachment = {
  id: number;
  fileName: string;
  filePath: string;
  uploadedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type PurchaseOrderStatusHistoryEntry = {
  id: number;
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: { id: number; fullName: string } | null;
  createdAt: string;
};

export type ProformaInvoiceStatus = "waiting" | "approved" | "rejected";

export type ProformaInvoiceItem = {
  id: number;
  itemName: string;
  item?: { id: number; name: string; code?: string | null } | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | string | null;
};

export type ProformaInvoice = {
  id: number;
  piNumber?: string | null;
  piDate?: string | null;
  currency: string;
  exchangeRate: number | string;
  paymentTerms?: string | null;
  validityDate?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  status: ProformaInvoiceStatus;
  items: ProformaInvoiceItem[];
  /** Only present when fetched from the org-wide Proforma Invoices list (not when embedded in PurchaseOrder.proformaInvoices). */
  purchaseOrder?: { id: number; poNumber?: string | null; vendor?: Vendor | null; project?: { id: number; name: string } | null } | null;
  createdAt: string;
  updatedAt: string;
};

export type ShipmentTransportMode = "road" | "sea" | "air";
export type ShipmentStatus = "booked" | "in_transit" | "arrived" | "delivered";

export type Insurance = {
  id: number;
  insuranceCompany?: string | null;
  policyNumber?: string | null;
  coverage?: number | string | null;
  premium?: number | string | null;
  claimStatus?: string | null;
};

export type CustomsDocumentType =
  | "bill_of_lading"
  | "commercial_invoice"
  | "packing_list"
  | "certificate_of_origin"
  | "insurance_certificate"
  | "other";

export type CustomsDocument = {
  id: number;
  documentType: CustomsDocumentType;
  fileName: string;
  filePath: string;
  createdAt: string;
};

export type Customs = {
  id: number;
  customDeclarationNumber?: string | null;
  billOfEntry?: string | null;
  hsCode?: string | null;
  clearingAgent?: string | null;
  port?: string | null;
  importDuty?: number | string | null;
  vat?: number | string | null;
  excise?: number | string | null;
  serviceCharge?: number | string | null;
  documentationCost?: number | string | null;
  inspectionCost?: number | string | null;
  warehouseCost?: number | string | null;
  miscellaneousCost?: number | string | null;
  documents: CustomsDocument[];
};

export type Shipment = {
  id: number;
  shipmentNo?: string | null;
  transportMode: ShipmentTransportMode;
  transportCompany?: string | null;
  containerNo?: string | null;
  vehicleNo?: string | null;
  trackingNo?: string | null;
  etd?: string | null;
  eta?: string | null;
  arrivalDate?: string | null;
  status: ShipmentStatus;
  freightCost?: number | string | null;
  loadingCost?: number | string | null;
  unloadingCost?: number | string | null;
  fuelCost?: number | string | null;
  miscellaneousCost?: number | string | null;
  localTaxCost?: number | string | null;
  insurance?: Insurance | null;
  customs?: Customs | null;
};

export type GoodsReceiptStatus = "pending_inspection" | "accepted" | "partially_accepted" | "rejected";

export type GoodsReceiptItem = {
  id: number;
  purchaseOrderItemId: number | null;
  receivedQuantity: number;
  damagedQuantity: number;
};

export type GoodsReceiptPhoto = {
  id: number;
  fileName: string;
  filePath: string;
  createdAt: string;
};

export type GoodsReceipt = {
  id: number;
  grnNumber?: string | null;
  inspectionResult?: string | null;
  status: GoodsReceiptStatus;
  warehouse?: { id: number; name: string } | null;
  receivedBy?: { id: number; fullName: string } | null;
  items: GoodsReceiptItem[];
  photos: GoodsReceiptPhoto[];
  createdAt: string;
};

/** Always computed on the fly (GET /purchase-orders/:id/cost-sheet), never stored — spec section 9's landed-cost breakdown. */
export type CostSheet = {
  piValue: number;
  piSource: "proforma_invoice" | "purchase_order_items";
  freight: number;
  loading: number;
  unloading: number;
  fuel: number;
  shipmentMiscellaneous: number;
  localTax: number;
  insurancePremium: number;
  customsDuty: number;
  customsVat: number;
  customsExcise: number;
  customsServiceCharge: number;
  customsDocumentation: number;
  customsInspection: number;
  customsWarehouse: number;
  customsMiscellaneous: number;
  grandTotal: number;
  totalQuantity: number;
  landedCostPerUnit: number;
};

export type PurchaseOrder = {
  id: number;
  poNumber?: string | null;
  deliveryAddress?: string | null;
  paymentTerms?: string | null;
  deliveryDate?: string | null;
  incoterms?: string | null;
  taxPercent?: number | string | null;
  terms?: string | null;
  /** Free-text shipping arrangement for the PO PDF (e.g. "Ex-factory, Bhiwadi, Rajasthan") — distinct from `incoterms`. */
  shippingTerms?: string | null;
  /** Free-text delivery period for the PO PDF (e.g. "Within 6 weeks of submission of PO.") — distinct from `deliveryDate`, which is a specific date. */
  deliveryPeriod?: string | null;
  finalDestination?: string | null;
  purchaseType: PurchaseType;
  status: PurchaseOrderStatus;
  vendor?: Vendor | null;
  vendorId?: number | null;
  project?: { id: number; name: string } | null;
  projectId?: number;
  purchaseRequest?: { id: number; prNumber?: string | null } | null;
  items: PurchaseOrderItem[];
  attachments?: PurchaseOrderAttachment[];
  statusHistory?: PurchaseOrderStatusHistoryEntry[];
  proformaInvoices?: ProformaInvoice[];
  shipment?: Shipment | null;
  goodsReceipts?: GoodsReceipt[];
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderDetail = {
  purchaseOrder: PurchaseOrder;
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
  poStatusBreakdown: { status: PurchaseOrderStatus; count: number }[];
  warehouseUtilization: { id: number; name: string; used: number; capacity: number }[];
  stockMovementTrend: { month: string; receipt: number; issue: number; adjustment: number; transferred: number }[];
  topPurchasedItems: { id: number; itemName: string; value: number }[];
  projectMaterialConsumption: { projectName: string; value: number }[];
  inventoryAging: Record<string, number | string>[];
  vendorPerformance: { id: number; name: string; avgDeliveryDays: number | null; purchaseVolume: number }[];
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
  /** Bikram Sambat year. */
  year: number;
  /** Bikram Sambat month, 1-12 (Baishakh = 1). */
  month: number;
  contractEnergy?: number | string | null;
  /** Not populated by the backend — actual generation is merged in client-side
   * from the daily-generation summary buckets (see fetchGenerationBuckets). */
  actualGeneration?: number | string | null;
  incomeReceived?: number | string | null;
  monthlyExpenditure?: number | string | null;
  sparePartPurchase?: number | string | null;
  createdAt: string;
};

/** One day's row from the Energy Performance daily entry grid. */
export type DailyGeneration = {
  date: string; // AD, YYYY-MM-DD
  generation?: number | string | null;
  checkMeterInitial?: number | string | null;
  checkMeterFinal?: number | string | null;
  checkMeterDifference?: number | string | null;
  mainMeterInitial?: number | string | null;
  mainMeterFinal?: number | string | null;
  mainMeterDifference?: number | string | null;
};

/** One date-range bucket to sum generation over (see fetchGenerationBuckets). */
export type GenerationSummaryBucket = { key: number; startDate: string; endDate: string };
export type GenerationSummaryBucketResult = { key: number; generation: number | string | null };

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
