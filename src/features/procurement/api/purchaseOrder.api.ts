import api from "../../../api/axios";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType, CostSheet } from "../../../types";

export interface CreatePurchaseOrderItemInput {
  itemName: string;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  notes?: string | null;
}

export interface CreatePurchaseOrderInput {
  vendorId?: number | null;
  items: CreatePurchaseOrderItemInput[];
}

/** POST create a purchase order directly for one project — no Purchase Request involved. */
export async function createPurchaseOrder(
  projectId: string,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(
    `/api/projects/${projectId}/purchase-orders`,
    input,
  );
  return res.data.purchaseOrder;
}

export interface PurchaseOrderInput {
  poNumber?: string;
  paymentTerms?: string;
  incoterms?: string;
  taxPercent?: number | null;
  terms?: string;
  deliveryPeriod?: string;
  finalDestination?: string;
  customerContactPerson?: string;
  currency?: string;
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

/** GET the full detail payload for one PO: items, PI list, shipment/insurance/customs, goods receipts, status history. */
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

/** POST the approve/reject decision — finance/super_admin only (enforced server-side). */
export async function decidePurchaseOrderApproval(
  id: number,
  decision: "approved" | "rejected",
): Promise<PurchaseOrder> {
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/approval`, { decision });
  return res.data.purchaseOrder;
}
