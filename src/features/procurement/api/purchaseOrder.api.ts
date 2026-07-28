import api from "../../../api/axios";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType, CostSheet } from "../../../types";

export interface PurchaseOrderInput {
  deliveryAddress?: string;
  paymentTerms?: string;
  deliveryDate?: string | null;
  incoterms?: string;
  taxPercent?: number | null;
  terms?: string;
  shippingTerms?: string;
  deliveryPeriod?: string;
  finalDestination?: string;
  purchaseType?: PurchaseType;
  status?: PurchaseOrderStatus;
  items?: { id: number; hsnCode?: string | null }[];
}

/** GET purchase orders for one project's tab. */
export async function fetchPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
  const res = await api.get<{ purchaseOrders: PurchaseOrder[] }>(`/api/projects/${projectId}/purchase-orders`);
  return res.data.purchaseOrders ?? [];
}

/** GET purchase orders across every project in the organization. */
export async function fetchOrganizationPurchaseOrders(): Promise<PurchaseOrder[]> {
  const res = await api.get<{ purchaseOrders: PurchaseOrder[] }>("/api/workspace/purchase-orders");
  return res.data.purchaseOrders ?? [];
}

/** GET the full detail payload for one PO: items, PI list, shipment/insurance/customs, goods receipts, attachments, status history. */
export async function fetchPurchaseOrderDetail(id: number): Promise<PurchaseOrder> {
  const res = await api.get<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/detail`);
  return res.data.purchaseOrder;
}

/** PUT update terms/delivery/purchaseType/status fields. */
export async function updatePurchaseOrder(id: number, input: PurchaseOrderInput): Promise<PurchaseOrder> {
  const res = await api.put<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}`, input);
  return res.data.purchaseOrder;
}

/** GET the computed landed-cost breakdown (spec's Cost Sheet). */
export async function fetchCostSheet(id: number): Promise<CostSheet> {
  const res = await api.get<{ costSheet: CostSheet }>(`/api/purchase-orders/${id}/cost-sheet`);
  return res.data.costSheet;
}

/** POST upload a document attachment, multipart. */
export async function uploadPurchaseOrderAttachment(id: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/api/purchase-orders/${id}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE an attachment. */
export async function deletePurchaseOrderAttachment(id: number, attachmentId: number): Promise<void> {
  await api.delete(`/api/purchase-orders/${id}/attachments/${attachmentId}`);
}
