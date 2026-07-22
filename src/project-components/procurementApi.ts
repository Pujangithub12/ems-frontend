import api from "../api/axios";
import { ProcurementItem, ProcurementItemDetail } from "../types";

export interface ProcurementItemInput {
  itemName: string;
  category?: ProcurementItem["category"];
  quantity: number;
  estimatedCost?: number | null;
  unitCost?: number | null;
  vendorName?: string;
  vendorId?: number | null;
  neededByDate?: string | null;
  notes?: string;
}

/** GET all procurement items for a project's Procurement tab. */
export async function fetchProcurementItems(
  projectId: string,
): Promise<ProcurementItem[]> {
  const res = await api.get<{ items: ProcurementItem[] }>(
    `/api/projects/${projectId}/procurement`,
  );
  return res.data.items ?? [];
}

/** GET all procurement items across every project in the workspace (sidebar Procurement page). */
export async function fetchWorkspaceProcurement(): Promise<ProcurementItem[]> {
  const res = await api.get<{ items: ProcurementItem[] }>("/api/workspace/procurement");
  return res.data.items ?? [];
}

/** POST add a purchase request. */
export async function createProcurementItem(
  projectId: string,
  input: ProcurementItemInput,
): Promise<ProcurementItem> {
  const res = await api.post<{ item: ProcurementItem }>(
    `/api/projects/${projectId}/procurement`,
    input,
  );
  return res.data.item;
}

/** PUT update fields and/or status on a procurement item. */
export async function updateProcurementItem(
  itemId: number,
  input: Partial<ProcurementItemInput> & { status?: ProcurementItem["status"] },
): Promise<ProcurementItem> {
  const res = await api.put<{ item: ProcurementItem }>(
    `/api/projects/procurement/${itemId}`,
    input,
  );
  return res.data.item;
}

/** DELETE a procurement item. */
export async function deleteProcurementItem(itemId: number): Promise<void> {
  await api.delete(`/api/projects/procurement/${itemId}`);
}

/** GET the drawer payload: item + status history/attachments/project allocation. */
export async function fetchProcurementItemDetail(itemId: number): Promise<ProcurementItemDetail> {
  const res = await api.get<ProcurementItemDetail>(`/api/projects/procurement/${itemId}/detail`);
  return res.data;
}

/** POST upload a document attachment (multipart). */
export async function uploadProcurementAttachment(itemId: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/api/projects/procurement/${itemId}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE an attachment. */
export async function deleteProcurementAttachment(itemId: number, attachmentId: number): Promise<void> {
  await api.delete(`/api/projects/procurement/${itemId}/attachments/${attachmentId}`);
}

/** Coerces a numeric column that may come back as a string (Postgres "numeric") to a number, or 0. */
export function toNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === "") return 0;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) ? num : 0;
}

/** Human-readable currency, e.g. "$1,250.00". Falls back to "--" when absent. */
export function formatCost(value?: number | string | null): string {
  if (value === null || value === undefined || value === "") return "--";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "--";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
