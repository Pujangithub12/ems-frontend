import api from "../../../api/axios";

export type MaterialTransactionType = "received" | "used";

export type MaterialVendorRef = { id: number; name: string } | null;

export type MaterialTransaction = {
  id: number;
  type: MaterialTransactionType;
  quantity: number;
  date: string; // YYYY-MM-DD
  vendor: MaterialVendorRef;
  unitPrice: number | null;
  workArea: string | null;
  issuedTo: string | null;
  reference: string | null;
  remarks: string | null;
  createdAt: string;
};

/** A custom field's value, keyed by MaterialField id (string) — same loose
 * cell-value shape as the customTables mechanic. */
export type MaterialCustomFieldValue = string | number | boolean | null;

export type Material = {
  id: number;
  name: string;
  code: string | null;
  category: string | null;
  unit: string;
  minStock: number;
  vendor: MaterialVendorRef;
  customFields: Record<string, MaterialCustomFieldValue>;
  transactions: MaterialTransaction[];
};

export type SaveMaterialPayload = {
  name: string;
  code?: string | null;
  category?: string | null;
  unit: string;
  minStock?: number | null;
  vendorId?: number | null;
  customFields?: Record<string, MaterialCustomFieldValue>;
};

export type AddMaterialTransactionPayload = {
  type: MaterialTransactionType;
  quantity: number;
  date: string;
  vendorId?: number | null;
  unitPrice?: number | null;
  workArea?: string | null;
  issuedTo?: string | null;
  reference?: string | null;
  remarks?: string | null;
};

/** GET /api/materials?projectId — every material for this project, with its
 * full transaction history embedded. */
export async function fetchMaterials(projectId: number): Promise<Material[]> {
  const res = await api.get("/api/materials", { params: { projectId } });
  return res.data.materials;
}

/** POST /api/materials?projectId */
export async function createMaterial(projectId: number, payload: SaveMaterialPayload): Promise<Material> {
  const res = await api.post("/api/materials", payload, { params: { projectId } });
  return res.data.material;
}

/** PUT /api/materials/:id */
export async function updateMaterial(id: number, payload: SaveMaterialPayload): Promise<Material> {
  const res = await api.put(`/api/materials/${id}`, payload);
  return res.data.material;
}

/** DELETE /api/materials/:id */
export async function deleteMaterial(id: number): Promise<void> {
  await api.delete(`/api/materials/${id}`);
}

/** POST /api/materials/:id/transactions */
export async function addMaterialTransaction(materialId: number, payload: AddMaterialTransactionPayload): Promise<MaterialTransaction> {
  const res = await api.post(`/api/materials/${materialId}/transactions`, payload);
  return res.data.transaction;
}

/** DELETE /api/materials/transactions/:id */
export async function deleteMaterialTransaction(id: number): Promise<void> {
  await api.delete(`/api/materials/transactions/${id}`);
}
