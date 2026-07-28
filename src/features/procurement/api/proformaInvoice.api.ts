import api from "../../../api/axios";
import { ProformaInvoice, ProformaInvoiceStatus } from "../../../types";

export interface ProformaInvoiceItemInput {
  itemName: string;
  itemId?: number;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
}

export interface ProformaInvoiceInput {
  piNumber?: string;
  piDate?: string;
  currency?: string;
  exchangeRate?: number;
  paymentTerms?: string;
  validityDate?: string;
  items?: ProformaInvoiceItemInput[];
}

/** POST create a proforma invoice for a purchase order. */
export async function createProformaInvoice(
  purchaseOrderId: number,
  input: ProformaInvoiceInput,
): Promise<ProformaInvoice> {
  const res = await api.post<{ proformaInvoice: ProformaInvoice }>(
    `/api/purchase-orders/${purchaseOrderId}/proforma-invoices`,
    input,
  );
  return res.data.proformaInvoice;
}

/** PUT update a proforma invoice's fields and/or full-replace its items. */
export async function updateProformaInvoice(
  id: number,
  input: Partial<ProformaInvoiceInput>,
): Promise<ProformaInvoice> {
  const res = await api.put<{ proformaInvoice: ProformaInvoice }>(`/api/proforma-invoices/${id}`, input);
  return res.data.proformaInvoice;
}

/** DELETE a proforma invoice. */
export async function deleteProformaInvoice(id: number): Promise<void> {
  await api.delete(`/api/proforma-invoices/${id}`);
}

/** PUT waiting/approved/rejected. */
export async function changeProformaInvoiceStatus(id: number, status: ProformaInvoiceStatus): Promise<ProformaInvoice> {
  const res = await api.put<{ proformaInvoice: ProformaInvoice }>(`/api/proforma-invoices/${id}/status`, { status });
  return res.data.proformaInvoice;
}

/** POST upload the single PI PDF, overwriting any previous file. */
export async function uploadProformaInvoiceFile(id: number, file: File): Promise<ProformaInvoice> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<{ proformaInvoice: ProformaInvoice }>(`/api/proforma-invoices/${id}/attachment`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.proformaInvoice;
}
