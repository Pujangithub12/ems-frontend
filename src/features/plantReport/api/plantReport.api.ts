import api from "../../../api/axios";

export type PlantReportColumnDataType = "text" | "number" | "date" | "boolean";
export type PlantReportCellValue = string | number | boolean | null;

export type PlantReportTable = {
  id: number;
  name: string;
  sortOrder: number;
  /** True only for the auto-created "Progress Tracker" tab — it can't be renamed or deleted. */
  isDefault: boolean;
};

export type PlantReportColumn = {
  id: number;
  name: string;
  dataType: PlantReportColumnDataType;
  sortOrder: number;
  /** Optional flat expected/target value — shown as a reference line on the Charts tab. */
  target: number | null;
};

export type PlantReportRow = {
  id: number;
  sortOrder: number;
  values: Record<string, PlantReportCellValue>;
};

export type PlantReportTableDetail = {
  table: PlantReportTable;
  columns: PlantReportColumn[];
  rows: PlantReportRow[];
};

export type SavePlantReportTablePayload = { name: string };
export type SavePlantReportColumnPayload = { name: string; dataType: PlantReportColumnDataType; target?: number | null };
export type SavePlantReportRowPayload = { values: Record<string, PlantReportCellValue> };

/** GET /api/plant-report-tables?projectId — list of tabs for this project (no columns/rows). */
export async function fetchPlantReportTables(projectId: number): Promise<PlantReportTable[]> {
  const res = await api.get("/api/plant-report-tables", { params: { projectId } });
  return res.data.tables;
}

/** GET /api/plant-report-tables/:id — one table's columns + rows. */
export async function fetchPlantReportTableDetail(id: number): Promise<PlantReportTableDetail> {
  const res = await api.get(`/api/plant-report-tables/${id}`);
  return { table: res.data.table, columns: res.data.columns, rows: res.data.rows };
}

/** POST /api/plant-report-tables?projectId */
export async function createPlantReportTable(projectId: number, payload: SavePlantReportTablePayload): Promise<PlantReportTable> {
  const res = await api.post("/api/plant-report-tables", payload, { params: { projectId } });
  return res.data.table;
}

/** PUT /api/plant-report-tables/:id */
export async function updatePlantReportTable(id: number, payload: SavePlantReportTablePayload): Promise<PlantReportTable> {
  const res = await api.put(`/api/plant-report-tables/${id}`, payload);
  return res.data.table;
}

/** DELETE /api/plant-report-tables/:id */
export async function deletePlantReportTable(id: number): Promise<void> {
  await api.delete(`/api/plant-report-tables/${id}`);
}

/** POST /api/plant-report-tables/:id/columns */
export async function createPlantReportColumn(tableId: number, payload: SavePlantReportColumnPayload): Promise<PlantReportColumn> {
  const res = await api.post(`/api/plant-report-tables/${tableId}/columns`, payload);
  return res.data.column;
}

/** PUT /api/plant-report-columns/:id */
export async function updatePlantReportColumn(id: number, payload: SavePlantReportColumnPayload): Promise<PlantReportColumn> {
  const res = await api.put(`/api/plant-report-columns/${id}`, payload);
  return res.data.column;
}

/** DELETE /api/plant-report-columns/:id */
export async function deletePlantReportColumn(id: number): Promise<void> {
  await api.delete(`/api/plant-report-columns/${id}`);
}

/** POST /api/plant-report-tables/:id/rows */
export async function createPlantReportRow(tableId: number, payload: SavePlantReportRowPayload): Promise<PlantReportRow> {
  const res = await api.post(`/api/plant-report-tables/${tableId}/rows`, payload);
  return res.data.row;
}

/** PUT /api/plant-report-rows/:id */
export async function updatePlantReportRow(id: number, payload: SavePlantReportRowPayload): Promise<PlantReportRow> {
  const res = await api.put(`/api/plant-report-rows/${id}`, payload);
  return res.data.row;
}

/** DELETE /api/plant-report-rows/:id */
export async function deletePlantReportRow(id: number): Promise<void> {
  await api.delete(`/api/plant-report-rows/${id}`);
}

/** Rows keyed by column id (string) — the spreadsheet is matched to this
 * table's *existing* columns by header name entirely client-side; import
 * never creates columns, so there's nothing to send but rows. */
export type ImportSheetPayload = {
  rows: Record<string, PlantReportCellValue>[];
};
export type ImportSheetResult = { rowsCreated: number };

/** POST /api/plant-report-tables/:id/import — appends every row from a
 * spreadsheet parsed client-side, filling only columns that already exist
 * on this table (matched by header name); it never creates new columns. */
export async function importPlantReportSheet(tableId: number, payload: ImportSheetPayload): Promise<ImportSheetResult> {
  const res = await api.post(`/api/plant-report-tables/${tableId}/import`, payload);
  return res.data;
}
