import api from "../api/axios";
import {
  InventoryItem,
  InventoryItemDetail,
  Warehouse,
  Vendor,
  InventorySerial,
  StockTransfer,
  InventoryTransaction,
} from "../types";

export interface InventoryItemInput {
  itemName: string;
  category?: InventoryItem["category"];
  quantity: number;
  unit?: string;
  status?: InventoryItem["status"];
  lastRestockedDate?: string | null;
  notes?: string;
  sku?: string;
  warehouseId?: number | null;
  reservedQuantity?: number;
  incomingQuantity?: number;
  averageCost?: number | null;
  supplier?: string;
  vendorId?: number | null;
  imageUrl?: string;
  warrantyExpiryDate?: string | null;
}

/** GET all inventory items for a project's Inventory tab. */
export async function fetchInventoryItems(projectId: string): Promise<InventoryItem[]> {
  const res = await api.get<{ items: InventoryItem[] }>(`/api/projects/${projectId}/inventory`);
  return res.data.items ?? [];
}

/** GET all inventory items across every project in the workspace (sidebar Inventory page). */
export async function fetchWorkspaceInventory(): Promise<InventoryItem[]> {
  const res = await api.get<{ items: InventoryItem[] }>("/api/workspace/inventory");
  return res.data.items ?? [];
}

/** POST add a stock item. */
export async function createInventoryItem(
  projectId: string,
  input: InventoryItemInput,
): Promise<InventoryItem> {
  const res = await api.post<{ item: InventoryItem }>(
    `/api/projects/${projectId}/inventory`,
    input,
  );
  return res.data.item;
}

/** PUT update fields and/or status on an inventory item. */
export async function updateInventoryItem(
  itemId: number,
  input: Partial<InventoryItemInput>,
): Promise<InventoryItem> {
  const res = await api.put<{ item: InventoryItem }>(`/api/projects/inventory/${itemId}`, input);
  return res.data.item;
}

/** DELETE an inventory item. */
export async function deleteInventoryItem(itemId: number): Promise<void> {
  await api.delete(`/api/projects/inventory/${itemId}`);
}

/** GET the drawer payload: item + batches/serials/transactions/transfers/attachments/history. */
export async function fetchInventoryItemDetail(itemId: number): Promise<InventoryItemDetail> {
  const res = await api.get<InventoryItemDetail>(`/api/projects/inventory/${itemId}/detail`);
  return res.data;
}

/** POST a manual stock adjustment (writes an InventoryTransaction). */
export async function adjustInventoryStock(
  itemId: number,
  delta: number,
  reason?: string,
): Promise<InventoryItem> {
  const res = await api.post<{ item: InventoryItem }>(`/api/projects/inventory/${itemId}/adjust`, {
    delta,
    reason,
  });
  return res.data.item;
}

/** POST a warehouse-to-warehouse transfer request. */
export async function createStockTransfer(
  itemId: number,
  input: { fromWarehouseId?: number; toWarehouseId: number; quantity: number; notes?: string },
): Promise<void> {
  await api.post(`/api/projects/inventory/${itemId}/transfers`, input);
}

/** PUT advance a transfer's status (e.g. mark completed). */
export async function updateStockTransferStatus(
  itemId: number,
  transferId: number,
  status: "pending" | "in_transit" | "completed" | "cancelled",
): Promise<void> {
  await api.put(`/api/projects/inventory/${itemId}/transfers/${transferId}`, { status });
}

/** POST add a batch/lot. */
export async function addInventoryBatch(
  itemId: number,
  input: { batchNumber: string; quantity?: number; manufactureDate?: string; expiryDate?: string },
): Promise<void> {
  await api.post(`/api/projects/inventory/${itemId}/batches`, input);
}

/** DELETE a batch/lot. */
export async function deleteInventoryBatch(itemId: number, batchId: number): Promise<void> {
  await api.delete(`/api/projects/inventory/${itemId}/batches/${batchId}`);
}

/** POST add a serial number. */
export async function addInventorySerial(
  itemId: number,
  input: { serialNumber: string; status?: InventorySerial["status"]; warrantyExpiryDate?: string; notes?: string },
): Promise<void> {
  await api.post(`/api/projects/inventory/${itemId}/serials`, input);
}

/** DELETE a serial number. */
export async function deleteInventorySerial(itemId: number, serialId: number): Promise<void> {
  await api.delete(`/api/projects/inventory/${itemId}/serials/${serialId}`);
}

/** POST upload a document attachment (multipart). */
export async function uploadInventoryAttachment(itemId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/api/projects/inventory/${itemId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE an attachment. */
export async function deleteInventoryAttachment(itemId: number, attachmentId: number): Promise<void> {
  await api.delete(`/api/projects/inventory/${itemId}/attachments/${attachmentId}`);
}

/** GET all warehouses in the workspace. */
export async function fetchWorkspaceWarehouses(): Promise<Warehouse[]> {
  const res = await api.get<{ warehouses: Warehouse[] }>("/api/workspace/warehouses");
  return res.data.warehouses ?? [];
}

/** POST create a warehouse. */
export async function createWarehouse(input: {
  name: string;
  code?: string;
  location?: string;
  capacity?: number;
}): Promise<Warehouse> {
  const res = await api.post<{ warehouse: Warehouse }>("/api/workspace/warehouses", input);
  return res.data.warehouse;
}

/** GET pending/in-transit transfers across the workspace, for the KPI strip. */
export async function fetchWorkspacePendingTransfers(): Promise<StockTransfer[]> {
  const res = await api.get<{ transfers: StockTransfer[] }>("/api/workspace/inventory/transfers");
  return res.data.transfers ?? [];
}

/** GET recent audit-log entries across the workspace, for the sidebar widget. */
export async function fetchWorkspaceInventoryTransactions(): Promise<InventoryTransaction[]> {
  const res = await api.get<{ transactions: InventoryTransaction[] }>(
    "/api/workspace/inventory/transactions",
  );
  return res.data.transactions ?? [];
}

/** GET all vendors in the workspace. */
export async function fetchWorkspaceVendors(): Promise<Vendor[]> {
  const res = await api.get<{ vendors: Vendor[] }>("/api/workspace/vendors");
  return res.data.vendors ?? [];
}

/** POST create a vendor. */
export async function createVendor(input: {
  name: string;
  code?: string;
  location?: string;
  rating?: number;
  contractExpiryDate?: string;
}): Promise<Vendor> {
  const res = await api.post<{ vendor: Vendor }>("/api/workspace/vendors", input);
  return res.data.vendor;
}

/** PUT update a vendor. */
export async function updateVendor(
  vendorId: number,
  input: { name?: string; code?: string; location?: string; rating?: number | null; contractExpiryDate?: string | null },
): Promise<Vendor> {
  const res = await api.put<{ vendor: Vendor }>(`/api/workspace/vendors/${vendorId}`, input);
  return res.data.vendor;
}
