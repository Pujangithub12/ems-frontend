import api from "../../../api/axios";
import {
  PurchaseRequest,
  PurchaseRequestDetail,
  PurchaseRequestPriority,
  PurchaseRequestStatus,
  PurchaseRequestAttachmentType,
  VendorQuote,
  PurchaseOrder,
} from "../../../types";

export interface PurchaseRequestItemInput {
  itemName?: string;
  itemId?: number | null;
  quantity: number;
  unit?: string;
  estimatedPrice?: number | null;
  notes?: string;
}

export interface PurchaseRequestInput {
  department?: string;
  priority?: PurchaseRequestPriority;
  reason?: string;
  items: PurchaseRequestItemInput[];
}

/** GET purchase requests for one project's tab. */
export async function fetchPurchaseRequests(projectId: string): Promise<PurchaseRequest[]> {
  const res = await api.get<{ requests: PurchaseRequest[] }>(`/api/projects/${projectId}/purchase-requests`);
  return res.data.requests ?? [];
}

/** GET purchase requests across every project in the organization. */
export async function fetchOrganizationPurchaseRequests(): Promise<PurchaseRequest[]> {
  const res = await api.get<{ requests: PurchaseRequest[] }>("/api/workspace/purchase-requests");
  return res.data.requests ?? [];
}

/** POST create a draft purchase request. */
export async function createPurchaseRequest(projectId: string, input: PurchaseRequestInput): Promise<PurchaseRequest> {
  const res = await api.post<{ purchaseRequest: PurchaseRequest }>(
    `/api/projects/${projectId}/purchase-requests`,
    input,
  );
  return res.data.purchaseRequest;
}

/** PUT update a draft purchase request's fields/items. */
export async function updatePurchaseRequest(
  id: number,
  input: Partial<PurchaseRequestInput>,
): Promise<PurchaseRequest> {
  const res = await api.put<{ purchaseRequest: PurchaseRequest }>(`/api/purchase-requests/${id}`, input);
  return res.data.purchaseRequest;
}

/** DELETE a draft purchase request. */
export async function deletePurchaseRequest(id: number): Promise<void> {
  await api.delete(`/api/purchase-requests/${id}`);
}

/** GET the drawer/detail payload: request + status history + attachments. */
export async function fetchPurchaseRequestDetail(id: number): Promise<PurchaseRequestDetail> {
  const res = await api.get<PurchaseRequestDetail>(`/api/purchase-requests/${id}/detail`);
  return res.data;
}

/** POST a status transition (draft->submitted->approved/rejected). */
export async function changePurchaseRequestStatus(
  id: number,
  status: PurchaseRequestStatus,
  notes?: string,
): Promise<PurchaseRequest> {
  const res = await api.post<{ purchaseRequest: PurchaseRequest }>(`/api/purchase-requests/${id}/status`, {
    status,
    ...(notes ? { notes } : {}),
  });
  return res.data.purchaseRequest;
}

/** POST add a "possible vendor" option to the Vendor Selection list. */
export async function addVendorQuote(
  id: number,
  input: { vendorId: number; price: number; notes?: string },
): Promise<VendorQuote> {
  const res = await api.post<{ quote: VendorQuote }>(`/api/purchase-requests/${id}/vendor-quotes`, input);
  return res.data.quote;
}

/** PUT edit a vendor quote's price/notes/vendor. */
export async function updateVendorQuote(
  id: number,
  quoteId: number,
  input: { vendorId?: number; price?: number; notes?: string },
): Promise<VendorQuote> {
  const res = await api.put<{ quote: VendorQuote }>(`/api/purchase-requests/${id}/vendor-quotes/${quoteId}`, input);
  return res.data.quote;
}

/** DELETE a vendor quote. */
export async function deleteVendorQuote(id: number, quoteId: number): Promise<void> {
  await api.delete(`/api/purchase-requests/${id}/vendor-quotes/${quoteId}`);
}

/** POST mark one vendor quote selected (unmarks every other quote on the same request). */
export async function selectVendorQuote(id: number, quoteId: number): Promise<PurchaseRequest> {
  const res = await api.post<{ purchaseRequest: PurchaseRequest }>(
    `/api/purchase-requests/${id}/vendor-quotes/${quoteId}/select`,
  );
  return res.data.purchaseRequest;
}

/** POST the "Generate Purchase Order" action — requires an approved request with a selected vendor quote. */
export async function generatePurchaseOrder(id: number): Promise<PurchaseOrder> {
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-requests/${id}/generate-po`);
  return res.data.purchaseOrder;
}

/** POST upload a document attachment (quotation/comparison sheet/general), multipart. */
export async function uploadPurchaseRequestAttachment(
  id: number,
  file: File,
  documentType: PurchaseRequestAttachmentType = "general",
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);
  await api.post(`/api/purchase-requests/${id}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE an attachment. */
export async function deletePurchaseRequestAttachment(id: number, attachmentId: number): Promise<void> {
  await api.delete(`/api/purchase-requests/${id}/attachments/${attachmentId}`);
}
