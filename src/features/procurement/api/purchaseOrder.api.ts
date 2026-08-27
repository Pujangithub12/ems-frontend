import api from "../../../api/axios";
import { PurchaseOrder, PurchaseOrderStatus, PurchaseType, CostSheet } from "../../../types";

export interface CreatePurchaseOrderItemInput {
  itemName: string;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  description?: string | null;
}

export interface CreatePurchaseOrderInput {
  vendorId?: number | null;
  items?: CreatePurchaseOrderItemInput[];
}

export interface AddPurchaseOrderItemInput {
  itemName: string;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  description?: string | null;
}

/** POST add a single line item to an existing purchase order (Overview tab's "Add Item"). */
export async function addPurchaseOrderItem(id: number, input: AddPurchaseOrderItemInput): Promise<PurchaseOrder> {
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/items`, input);
  return res.data.purchaseOrder;
}

export interface EditPurchaseOrderItemInput {
  itemName: string;
  itemId?: number | null;
  quantity: number;
  unit?: string | null;
  unitPrice?: number | null;
  description?: string | null;
}

/** PUT full edit of one existing line item (Overview tab's Line Items table). */
export async function editPurchaseOrderItem(
  id: number,
  itemId: number,
  input: EditPurchaseOrderItemInput,
): Promise<PurchaseOrder> {
  const res = await api.put<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/items/${itemId}`, input);
  return res.data.purchaseOrder;
}

/** DELETE one line item from a purchase order. */
export async function deletePurchaseOrderItem(id: number, itemId: number): Promise<PurchaseOrder> {
  const res = await api.delete<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/items/${itemId}`);
  return res.data.purchaseOrder;
}

/** POST create a purchase order directly — no Purchase Request involved. Pass a projectId to
 * create it under that project (project-scoped route), or null to create it without one (the
 * project-less /purchase-orders route, used by the org-wide Purchase Orders page's form). */
export async function createPurchaseOrder(
  projectId: string | null,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  const url = projectId ? `/api/projects/${projectId}/purchase-orders` : "/api/purchase-orders";
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(url, input);
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
