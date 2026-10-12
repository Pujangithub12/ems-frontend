import api from "../../../api/axios";
import { DebtorRow, DebtorClaimRow, DebtorDetail } from "../../../types";

export interface SaveDebtorInput {
  debtorName: string;
  itemName: string;
  referenceNumber?: string | null;
  lcNumber?: string | null;
  amountDue: number;
  claimAmount?: number;
  paymentTerms?: string | null;
  projectId?: number | null;
  /** "NPR" | "INR" | "USD" | "RMB" */
  currency?: string;
}

export interface AddDebtorPaymentInput {
  amount: number;
  receivedDate: string;
  reference?: string | null;
  notes?: string | null;
}

export async function fetchDebtors(): Promise<DebtorRow[]> {
  const res = await api.get<{ rows: DebtorRow[] }>("/api/workspace/debtors");
  return res.data.rows ?? [];
}

export async function createDebtor(input: SaveDebtorInput): Promise<DebtorRow> {
  const res = await api.post<{ row: DebtorRow }>("/api/workspace/debtors", input);
  return res.data.row;
}

export async function updateDebtor(id: number, input: SaveDebtorInput): Promise<DebtorRow> {
  const res = await api.put<{ row: DebtorRow }>(`/api/workspace/debtors/${id}`, input);
  return res.data.row;
}

export async function deleteDebtor(id: number): Promise<void> {
  await api.delete(`/api/workspace/debtors/${id}`);
}

export async function addDebtorPayment(id: number, input: AddDebtorPaymentInput): Promise<DebtorRow> {
  const res = await api.post<{ row: DebtorRow }>(`/api/workspace/debtors/${id}/payments`, input);
  return res.data.row;
}

export async function deleteDebtorPayment(id: number, paymentId: number): Promise<DebtorRow> {
  const res = await api.delete<{ row: DebtorRow }>(`/api/workspace/debtors/${id}/payments/${paymentId}`);
  return res.data.row;
}

export interface SaveDebtorClaimInput {
  paymentDate?: string | null;
  purpose?: string | null;
  commercialInvoiceNo?: string | null;
  claimReceived: number;
  reimbursementPurpose?: string | null;
  reimbursementAmount: number;
  reimbursementReceived: number;
}

export async function fetchDebtorDetail(id: number): Promise<DebtorDetail> {
  const res = await api.get<DebtorDetail>(`/api/workspace/debtors/${id}`);
  return res.data;
}

export async function createDebtorClaim(id: number, input: SaveDebtorClaimInput): Promise<DebtorClaimRow> {
  const res = await api.post<{ claim: DebtorClaimRow }>(`/api/workspace/debtors/${id}/claims`, input);
  return res.data.claim;
}

export async function updateDebtorClaim(id: number, claimId: number, input: SaveDebtorClaimInput): Promise<DebtorClaimRow> {
  const res = await api.put<{ claim: DebtorClaimRow }>(`/api/workspace/debtors/${id}/claims/${claimId}`, input);
  return res.data.claim;
}

export async function deleteDebtorClaim(id: number, claimId: number): Promise<void> {
  await api.delete(`/api/workspace/debtors/${id}/claims/${claimId}`);
}
