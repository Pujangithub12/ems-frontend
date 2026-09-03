import api from "../../../api/axios";
import { PurchaseOrder, FinancePurchaseOrderRow, VendorFinanceSummary, ItemCostReportRow, FinanceCostBreakdown } from "../../../types";

/** GET the org-wide Finance ledger — one row per PO (vendor, item value, amount paid, outstanding balance). */
export async function fetchFinanceOverview(): Promise<FinancePurchaseOrderRow[]> {
  const res = await api.get<{ rows: FinancePurchaseOrderRow[] }>("/api/workspace/finance/purchase-orders");
  return res.data.rows ?? [];
}

/** GET today's USD/INR/RMB -> NPR selling rates (NRB), keyed by currency code plus NPR: 1. */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  const res = await api.get<{ date: string; rates: Record<string, number> }>("/api/workspace/finance/exchange-rates");
  return res.data.rates ?? { NPR: 1 };
}

/** GET one vendor's POs plus aggregated totals (Total Procurement / Total Amount Paid / Total Outstanding). */
export async function fetchVendorFinanceSummary(vendorId: number): Promise<VendorFinanceSummary> {
  const res = await api.get<VendorFinanceSummary>(`/api/workspace/finance/vendors/${vendorId}`);
  return res.data;
}

/** GET the org-wide item cost report (item / major cost / freight / LC number / LC charge / LC commission / VAT). */
export async function fetchItemCostReport(): Promise<ItemCostReportRow[]> {
  const res = await api.get<{ rows: ItemCostReportRow[] }>("/api/workspace/finance/items");
  return res.data.rows ?? [];
}

export interface AddPurchaseOrderPaymentInput {
  amount: number;
  paidDate: string;
  /** NPR per 1 unit of the row's currency at the time of payment — only for non-NPR rows. */
  exchangeRate?: number | null;
  reference?: string | null;
  notes?: string | null;
}

/** POST log one installment paid against a purchase order. */
export async function addPurchaseOrderPayment(id: number, input: AddPurchaseOrderPaymentInput): Promise<PurchaseOrder> {
  const res = await api.post<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/payments`, input);
  return res.data.purchaseOrder;
}

/** DELETE one logged payment. */
export async function deletePurchaseOrderPayment(id: number, paymentId: number): Promise<PurchaseOrder> {
  const res = await api.delete<{ purchaseOrder: PurchaseOrder }>(`/api/purchase-orders/${id}/payments/${paymentId}`);
  return res.data.purchaseOrder;
}

export interface SaveFinanceManualRecordInput {
  vendorName: string;
  itemName: string;
  referenceNumber?: string | null;
  itemValue: number;
  paymentTerms?: string | null;
  vendorId?: number | null;
  /** "NPR" | "INR" | "USD" | "RMB" — falls back to "NPR" when unset. */
  currency?: string;
}

/** POST a freeform Finance ledger row that isn't tied to any real Purchase Order. */
export async function createFinanceManualRecord(input: SaveFinanceManualRecordInput): Promise<FinancePurchaseOrderRow> {
  const res = await api.post<{ row: FinancePurchaseOrderRow }>("/api/workspace/finance/manual-records", input);
  return res.data.row;
}

/** PUT edits a manually-entered ledger row. */
export async function updateFinanceManualRecord(id: number, input: SaveFinanceManualRecordInput): Promise<FinancePurchaseOrderRow> {
  const res = await api.put<{ row: FinancePurchaseOrderRow }>(`/api/workspace/finance/manual-records/${id}`, input);
  return res.data.row;
}

/** DELETE a manually-entered ledger row (and its payment history). */
export async function deleteFinanceManualRecord(id: number): Promise<void> {
  await api.delete(`/api/workspace/finance/manual-records/${id}`);
}

/** POST log one installment paid against a manual record. */
export async function addManualRecordPayment(id: number, input: AddPurchaseOrderPaymentInput): Promise<FinancePurchaseOrderRow> {
  const res = await api.post<{ row: FinancePurchaseOrderRow }>(`/api/workspace/finance/manual-records/${id}/payments`, input);
  return res.data.row;
}

/** DELETE one logged payment against a manual record. */
export async function deleteManualRecordPayment(id: number, paymentId: number): Promise<FinancePurchaseOrderRow> {
  const res = await api.delete<{ row: FinancePurchaseOrderRow }>(`/api/workspace/finance/manual-records/${id}/payments/${paymentId}`);
  return res.data.row;
}

/** GET the cost breakdown (Item Procure / Major Cost / Freight / LC.../ VAT / Remarks) for one
 * Finance row — a PO's line items or a manual record's single line, reached by clicking that row. */
export async function fetchFinanceCostBreakdown(source: "po" | "manual", id: number): Promise<FinanceCostBreakdown> {
  const path = source === "po" ? `/api/workspace/finance/purchase-orders/${id}/cost-breakdown` : `/api/workspace/finance/manual-records/${id}/cost-breakdown`;
  const res = await api.get<FinanceCostBreakdown>(path);
  return res.data;
}

export interface EditCostBreakdownRowInput {
  itemName: string;
  majorCost: number;
  freight: number;
  lcNumber?: string | null;
  lcAmount: number;
  lcCharge: number;
  lcCommission: number;
  vat: number;
  importDuties: number;
  insurance: number;
  refundableAmount: number;
  refundedAmount: number;
  remarks?: string | null;
}

/** PUT saves a full row's edits on the cost-breakdown page — for a "po" row this is one
 * PurchaseOrderItem (itemId required); for "manual" it's the record's single line. */
export async function updateCostBreakdownRow(
  source: "po" | "manual",
  id: number,
  input: EditCostBreakdownRowInput,
  itemId?: number | null,
): Promise<void> {
  const path =
    source === "po"
      ? `/api/workspace/finance/purchase-orders/${id}/items/${itemId}`
      : `/api/workspace/finance/manual-records/${id}/breakdown`;
  await api.put(path, input);
}
