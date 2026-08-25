import api from "../../../api/axios";

export type PlantReportStaffMember = { id: number; fullName: string };
export type PlantReportProject = { id: number; name: string };

export type PlantReportFieldDataType = "text" | "number" | "date" | "boolean";

export type PlantReportCustomField = {
  id: number;
  name: string;
  dataType: PlantReportFieldDataType;
  sortOrder: number;
};

export type PlantReportCustomValue = string | number | boolean | null;

export type PlantDailyReport = {
  id: number;
  date: string;
  project: PlantReportProject | null;
  customValues: Record<string, PlantReportCustomValue>;
  staff: PlantReportStaffMember[];
  staffCount: number;
  createdBy: PlantReportStaffMember | null;
  createdAt: string;
  updatedAt: string;
};

/** Sum/avg across the month for one org-defined numeric custom field. */
export type PlantReportCustomFieldTotal = {
  fieldId: number;
  name: string;
  sum: number | null;
  avg: number | null;
};

export type PlantReportSummary = {
  customFieldTotals: PlantReportCustomFieldTotal[];
  daysLogged: number;
};

export type PlantReportMonthResponse = {
  reports: PlantDailyReport[];
  summary: PlantReportSummary;
  year: number;
  month: number;
};

export type PlantReportPrefillResponse = { exists: true; report: PlantDailyReport } | { exists: false };

export type SavePlantReportPayload = {
  date: string;
  projectId?: number | null;
  staffUserIds?: number[];
  /** Keyed by custom field id (as a string). */
  customValues?: Record<string, PlantReportCustomValue>;
};

/** GET /api/plant-reports?year=&month=&projectId= — omit projectId for a
 * combined total across every project. */
export async function getPlantReportsForMonth(
  year: number,
  month: number,
  projectId?: number | null,
): Promise<PlantReportMonthResponse> {
  const res = await api.get("/api/plant-reports", {
    params: { year, month, ...(projectId ? { projectId } : {}) },
  });
  return res.data;
}

/** GET /api/plant-reports/prefill?date=YYYY-MM-DD&projectId= */
export async function getPlantReportPrefill(
  date: string,
  projectId?: number | null,
): Promise<PlantReportPrefillResponse> {
  const res = await api.get("/api/plant-reports/prefill", {
    params: { date, ...(projectId ? { projectId } : {}) },
  });
  return res.data;
}

/** POST /api/plant-reports */
export async function createPlantReport(payload: SavePlantReportPayload): Promise<PlantDailyReport> {
  const res = await api.post("/api/plant-reports", payload);
  return res.data.report;
}

/** PUT /api/plant-reports/:id */
export async function updatePlantReport(
  id: number,
  payload: SavePlantReportPayload,
): Promise<PlantDailyReport> {
  const res = await api.put(`/api/plant-reports/${id}`, payload);
  return res.data.report;
}

/** DELETE /api/plant-reports/:id */
export async function deletePlantReport(id: number): Promise<void> {
  await api.delete(`/api/plant-reports/${id}`);
}

export type SavePlantReportFieldPayload = {
  name: string;
  dataType: PlantReportFieldDataType;
};

/** GET /api/plant-report-fields — every custom field this organization has defined. */
export async function getPlantReportFields(): Promise<PlantReportCustomField[]> {
  const res = await api.get("/api/plant-report-fields");
  return res.data.fields;
}

/** POST /api/plant-report-fields */
export async function createPlantReportField(
  payload: SavePlantReportFieldPayload,
): Promise<PlantReportCustomField> {
  const res = await api.post("/api/plant-report-fields", payload);
  return res.data.field;
}

/** PUT /api/plant-report-fields/:id */
export async function updatePlantReportField(
  id: number,
  payload: SavePlantReportFieldPayload,
): Promise<PlantReportCustomField> {
  const res = await api.put(`/api/plant-report-fields/${id}`, payload);
  return res.data.field;
}

/** DELETE /api/plant-report-fields/:id */
export async function deletePlantReportField(id: number): Promise<void> {
  await api.delete(`/api/plant-report-fields/${id}`);
}
