import api from "../../../api/axios";
import { Quotation } from "../../../types";

export interface QuotationItemInput {
  itemName: string;
  description?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
}

interface QuotationInputBase {
  quotationNumber?: string;
  quotationDate?: string;
  title?: string;
  currency?: string;
  fromPan?: string;
  regNo?: string;
  customerName?: string;
  customerAddress?: string;
  customerContact?: string;
  customerEmail?: string;
  customerPan?: string;
  priceBasis?: string;
  deliveryPeriod?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  validityPeriod?: string;
  taxPercent?: number;
  signatoryName?: string;
  signatoryDesignation?: string;
  items?: QuotationItemInput[];
}

/** Every field but `items` may be null: on edit, null clears a saved value (undefined is dropped from the JSON, so the backend would leave it untouched). */
export type QuotationInput = {
  [K in keyof QuotationInputBase]?: K extends "items" ? QuotationInputBase[K] : QuotationInputBase[K] | null;
};

/** GET every quotation in the organization, for the sidebar Quotations page. */
export async function fetchAllQuotations(): Promise<Quotation[]> {
  const res = await api.get<{ quotations: Quotation[] }>("/api/workspace/quotations");
  return res.data.quotations ?? [];
}

/** POST create a quotation. */
export async function createQuotation(input: QuotationInput): Promise<Quotation> {
  const res = await api.post<{ quotation: Quotation }>("/api/workspace/quotations", input);
  return res.data.quotation;
}

/** PUT update a quotation's fields and/or full-replace its items. */
export async function updateQuotation(id: number, input: Partial<QuotationInput>): Promise<Quotation> {
  const res = await api.put<{ quotation: Quotation }>(`/api/quotations/${id}`, input);
  return res.data.quotation;
}

/** DELETE a quotation. */
export async function deleteQuotation(id: number): Promise<void> {
  await api.delete(`/api/quotations/${id}`);
}
