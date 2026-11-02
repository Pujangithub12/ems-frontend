import api from "../../../api/axios";
import type { RequisitionFormData } from "../pdf/generatePdf";

/** One saved requisition, as the History list shows it (`data` is the full form). */
export interface RequisitionRecord {
  id: number;
  requisitionNo: string | null;
  requisitionDate: string | null;
  requestedBy: string | null;
  priority: string | null;
  itemCount: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  data: RequisitionFormData;
}

export async function fetchRequisitions(): Promise<RequisitionRecord[]> {
  const res = await api.get<{ rows: RequisitionRecord[] }>("/api/workspace/requisitions");
  return res.data.rows ?? [];
}

export async function createRequisition(data: RequisitionFormData): Promise<RequisitionRecord> {
  const res = await api.post<{ row: RequisitionRecord }>("/api/workspace/requisitions", { data });
  return res.data.row;
}

export async function updateRequisition(id: number, data: RequisitionFormData): Promise<RequisitionRecord> {
  const res = await api.put<{ row: RequisitionRecord }>(`/api/workspace/requisitions/${id}`, { data });
  return res.data.row;
}

export async function deleteRequisition(id: number): Promise<void> {
  await api.delete(`/api/workspace/requisitions/${id}`);
}
