import api from "../../../api/axios";
import { GoodsReceipt, GoodsReceiptStatus } from "../../../types";

export interface GoodsReceiptItemInput {
  purchaseOrderItemId: number;
  receivedQuantity: number;
  damagedQuantity?: number;
}

export interface GoodsReceiptInput {
  warehouseId?: number;
  inspectionResult?: string;
  items: GoodsReceiptItemInput[];
}

/** POST record a receipt of goods against a PO's line items. */
export async function createGoodsReceipt(purchaseOrderId: number, input: GoodsReceiptInput): Promise<GoodsReceipt> {
  const res = await api.post<{ goodsReceipt: GoodsReceipt }>(
    `/api/purchase-orders/${purchaseOrderId}/goods-receipts`,
    input,
  );
  return res.data.goodsReceipt;
}

/** PUT accept/partially-accept/reject a GRN — accepting is what increments Inventory. */
export async function updateGoodsReceiptStatus(
  id: number,
  status: GoodsReceiptStatus,
  inspectionResult?: string,
): Promise<GoodsReceipt> {
  const res = await api.put<{ goodsReceipt: GoodsReceipt }>(`/api/goods-receipts/${id}/status`, {
    status,
    ...(inspectionResult !== undefined ? { inspectionResult } : {}),
  });
  return res.data.goodsReceipt;
}

/** POST upload an inspection photo, multipart. */
export async function uploadGoodsReceiptPhoto(id: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/api/goods-receipts/${id}/photos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE an inspection photo. */
export async function deleteGoodsReceiptPhoto(id: number, photoId: number): Promise<void> {
  await api.delete(`/api/goods-receipts/${id}/photos/${photoId}`);
}
