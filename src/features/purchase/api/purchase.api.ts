import api from "../../../api/axios";

export type PurchasePaymentMode = "cash" | "credit";
export type PurchaseBillStatus = "pending" | "partial" | "paid";

export type PurchaseVendorInfo = {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  address: string | null;
};

export type PurchaseBill = {
  id: number;
  projectId: number;
  projectName: string;
  /** AD ISO date (YYYY-MM-DD) — displayed as Bikram Sambat on the page. */
  date: string;
  billNo: string | null;
  challanNo: string | null;
  vendorId: number | null;
  vendorName: string;
  vendor: PurchaseVendorInfo | null;
  material: string;
  unit: string | null;
  quantity: number;
  rate: number;
  vatRate: number;
  actualAmount: number;
  vehicleNo: string | null;
  paymentMode: PurchasePaymentMode;
  paidBy: string | null;
  billStatus: PurchaseBillStatus;
  site: string | null;
  remarks: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavePurchaseBillPayload = {
  projectId: number;
  date: string;
  billNo?: string | null;
  challanNo?: string | null;
  vendorName: string;
  material: string;
  unit?: string | null;
  quantity: number;
  rate: number;
  vatRate?: number | null;
  actualAmount?: number | null;
  vehicleNo?: string | null;
  paymentMode?: PurchasePaymentMode | null;
  paidBy?: string | null;
  billStatus?: PurchaseBillStatus | null;
  site?: string | null;
  remarks?: string | null;
};

export type ImportPurchaseBillsResult = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

/** GET /api/purchase-bills[?projectId] — every bill for one project, or the whole organization. */
export async function fetchPurchaseBills(projectId?: number): Promise<PurchaseBill[]> {
  const res = await api.get("/api/purchase-bills", { params: projectId ? { projectId } : undefined });
  return res.data.bills;
}

/** POST /api/purchase-bills */
export async function createPurchaseBill(payload: SavePurchaseBillPayload): Promise<PurchaseBill> {
  const res = await api.post("/api/purchase-bills", payload);
  return res.data.bill;
}

/** PUT /api/purchase-bills/:id */
export async function updatePurchaseBill(id: number, payload: SavePurchaseBillPayload): Promise<PurchaseBill> {
  const res = await api.put(`/api/purchase-bills/${id}`, payload);
  return res.data.bill;
}

/** DELETE /api/purchase-bills/:id */
export async function deletePurchaseBill(id: number): Promise<void> {
  await api.delete(`/api/purchase-bills/${id}`);
}

/** POST /api/purchase-bills/import */
export async function importPurchaseBills(
  projectId: number,
  rows: Omit<SavePurchaseBillPayload, "projectId">[],
): Promise<ImportPurchaseBillsResult> {
  const res = await api.post("/api/purchase-bills/import", { projectId, rows });
  return res.data;
}
