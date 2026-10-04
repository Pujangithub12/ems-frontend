import api from "../../../api/axios";

export type MaterialCustomColumnDataType = "text" | "number" | "date" | "boolean";
export type MaterialCustomCellValue = string | number | boolean | null;

export type MaterialCustomTable = {
  id: number;
  name: string;
  sortOrder: number;
};

export type MaterialCustomColumn = {
  id: number;
  name: string;
  dataType: MaterialCustomColumnDataType;
  sortOrder: number;
  target: number | null;
};

export type MaterialCustomRow = {
  id: number;
  sortOrder: number;
  values: Record<string, MaterialCustomCellValue>;
};

export type MaterialCustomTableDetail = {
  table: MaterialCustomTable;
  columns: MaterialCustomColumn[];
  rows: MaterialCustomRow[];
};

export type SaveMaterialCustomTablePayload = { name: string };
export type SaveMaterialCustomColumnPayload = { name: string; dataType: MaterialCustomColumnDataType; target?: number | null };
export type SaveMaterialCustomRowPayload = { values: Record<string, MaterialCustomCellValue> };

/** GET /api/material-custom-tables?projectId — list of custom tabs for this project (no columns/rows). */
export async function fetchMaterialCustomTables(projectId: number): Promise<MaterialCustomTable[]> {
  const res = await api.get("/api/material-custom-tables", { params: { projectId } });
  return res.data.tables;
}

/** GET /api/material-custom-tables/:id — one table's columns + rows. */
export async function fetchMaterialCustomTableDetail(id: number): Promise<MaterialCustomTableDetail> {
  const res = await api.get(`/api/material-custom-tables/${id}`);
  return { table: res.data.table, columns: res.data.columns, rows: res.data.rows };
}

/** POST /api/material-custom-tables?projectId */
export async function createMaterialCustomTable(
  projectId: number,
  payload: SaveMaterialCustomTablePayload,
): Promise<MaterialCustomTable> {
  const res = await api.post("/api/material-custom-tables", payload, { params: { projectId } });
  return res.data.table;
}

/** PUT /api/material-custom-tables/:id */
export async function updateMaterialCustomTable(id: number, payload: SaveMaterialCustomTablePayload): Promise<MaterialCustomTable> {
  const res = await api.put(`/api/material-custom-tables/${id}`, payload);
  return res.data.table;
}

/** DELETE /api/material-custom-tables/:id */
export async function deleteMaterialCustomTable(id: number): Promise<void> {
  await api.delete(`/api/material-custom-tables/${id}`);
}

/** POST /api/material-custom-tables/:id/columns */
export async function createMaterialCustomColumn(
  tableId: number,
  payload: SaveMaterialCustomColumnPayload,
): Promise<MaterialCustomColumn> {
  const res = await api.post(`/api/material-custom-tables/${tableId}/columns`, payload);
  return res.data.column;
}

/** PUT /api/material-custom-columns/:id */
export async function updateMaterialCustomColumn(id: number, payload: SaveMaterialCustomColumnPayload): Promise<MaterialCustomColumn> {
  const res = await api.put(`/api/material-custom-columns/${id}`, payload);
  return res.data.column;
}

/** DELETE /api/material-custom-columns/:id */
export async function deleteMaterialCustomColumn(id: number): Promise<void> {
  await api.delete(`/api/material-custom-columns/${id}`);
}

/** POST /api/material-custom-tables/:id/rows */
export async function createMaterialCustomRow(tableId: number, payload: SaveMaterialCustomRowPayload): Promise<MaterialCustomRow> {
  const res = await api.post(`/api/material-custom-tables/${tableId}/rows`, payload);
  return res.data.row;
}

/** PUT /api/material-custom-rows/:id */
export async function updateMaterialCustomRow(id: number, payload: SaveMaterialCustomRowPayload): Promise<MaterialCustomRow> {
  const res = await api.put(`/api/material-custom-rows/${id}`, payload);
  return res.data.row;
}

/** DELETE /api/material-custom-rows/:id */
export async function deleteMaterialCustomRow(id: number): Promise<void> {
  await api.delete(`/api/material-custom-rows/${id}`);
}

export type ImportMaterialSheetPayload = {
  rows: Record<string, MaterialCustomCellValue>[];
};
export type ImportMaterialSheetResult = { rowsCreated: number };

/** POST /api/material-custom-tables/:id/import — appends every row from a
 * spreadsheet parsed client-side, filling only columns that already exist
 * on this table (matched by header name); it never creates new columns. */
export async function importMaterialCustomSheet(
  tableId: number,
  payload: ImportMaterialSheetPayload,
): Promise<ImportMaterialSheetResult> {
  const res = await api.post(`/api/material-custom-tables/${tableId}/import`, payload);
  return res.data;
}
