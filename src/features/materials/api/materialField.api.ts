import api from "../../../api/axios";

export type MaterialFieldDataType = "text" | "number" | "date" | "boolean";

export type MaterialField = {
  id: number;
  name: string;
  dataType: MaterialFieldDataType;
  sortOrder: number;
};

export type SaveMaterialFieldPayload = { name: string; dataType: MaterialFieldDataType };

/** GET /api/material-fields?projectId — this project's custom field
 * definitions, shown as extra columns on the Material Stock table. */
export async function fetchMaterialFields(projectId: number): Promise<MaterialField[]> {
  const res = await api.get("/api/material-fields", { params: { projectId } });
  return res.data.fields;
}

/** POST /api/material-fields?projectId */
export async function createMaterialField(projectId: number, payload: SaveMaterialFieldPayload): Promise<MaterialField> {
  const res = await api.post("/api/material-fields", payload, { params: { projectId } });
  return res.data.field;
}

/** PUT /api/material-fields/:id */
export async function updateMaterialField(id: number, payload: SaveMaterialFieldPayload): Promise<MaterialField> {
  const res = await api.put(`/api/material-fields/${id}`, payload);
  return res.data.field;
}

/** DELETE /api/material-fields/:id */
export async function deleteMaterialField(id: number): Promise<void> {
  await api.delete(`/api/material-fields/${id}`);
}
