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

export type PlantReportItem = {
  id: number;
  name: string;
  unit: string;
  trackStock: boolean;
  isActive: boolean;
  sortOrder: number;
};

/** One item's reading on a report, as returned by the API (opening/closing
 * are server-computed, never user-edited directly). */
export type PlantReportItemReading = {
  itemId: number;
  name: string;
  unit: string;
  trackStock: boolean;
  opening: number;
  received: number;
  used: number;
  closing: number;
  note: string | null;
};

export type PlantDailyReport = {
  id: number;
  date: string;
  project: PlantReportProject | null;
  steamInitial: number | null;
  steamFinal: number | null;
  steamTon: number | null;
  steamPressure: number | null;
  steamTemp: number | null;
  feedwaterTemp: number | null;
  pelletUsedKg: number | null;
  pelletsBag: number | null;
  pelletReceivedKg: number | null;
  pelletStockOpening: number;
  pelletStockClosing: number;
  waterInitial: number | null;
  waterFinal: number | null;
  waterFlow: number | null;
  burnerStatus: "running" | "stopped" | "maintenance" | null;
  burnerHours: number | null;
  shutdownReason: string | null;
  customValues: Record<string, PlantReportCustomValue>;
  items: PlantReportItemReading[];
  staff: PlantReportStaffMember[];
  staffCount: number;
  createdBy: PlantReportStaffMember | null;
  createdAt: string;
  updatedAt: string;
};

export type PlantReportItemTotal = {
  itemId: number;
  name: string;
  unit: string;
  totalUsed: number | null;
  totalReceived: number | null;
};

export type PlantReportSummary = {
  totalSteamTon: number | null;
  avgSteamPressure: number | null;
  avgSteamTemp: number | null;
  totalPelletUsedKg: number | null;
  totalPelletReceivedKg: number | null;
  itemTotals: PlantReportItemTotal[];
  totalWaterFlow: number | null;
  totalBurnerHours: number | null;
  shutdownDays: number;
  daysLogged: number;
};

export type PlantReportMonthResponse = {
  reports: PlantDailyReport[];
  summary: PlantReportSummary;
  year: number;
  month: number;
};

export type PlantReportPrefillResponse =
  | { exists: true; report: PlantDailyReport }
  | { exists: false; openingBalance: number; itemOpeningBalances: Record<string, number> };

export type SavePlantReportItemEntryPayload = {
  itemId: number;
  receivedQty?: number | null;
  usedQty?: number | null;
  note?: string | null;
};

export type SavePlantReportPayload = {
  date: string;
  projectId?: number | null;
  steamInitial?: number | null;
  steamFinal?: number | null;
  steamPressure?: number | null;
  steamTemp?: number | null;
  feedwaterTemp?: number | null;
  pelletUsedKg?: number | null;
  pelletsBag?: number | null;
  pelletReceivedKg?: number | null;
  waterInitial?: number | null;
  waterFinal?: number | null;
  burnerStatus?: "running" | "stopped" | "maintenance" | null;
  burnerHours?: number | null;
  shutdownReason?: string | null;
  staffUserIds?: number[];
  /** Keyed by custom field id (as a string). */
  customValues?: Record<string, PlantReportCustomValue>;
  itemEntries?: SavePlantReportItemEntryPayload[];
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

export type SavePlantReportItemPayload = {
  name: string;
  unit: string;
  trackStock?: boolean;
  isActive?: boolean;
};

/** GET /api/plant-report-items — active tracked items for this organization
 * (Pellets, Diesel, ...), in display order. */
export async function getPlantReportItems(): Promise<PlantReportItem[]> {
  const res = await api.get("/api/plant-report-items");
  return res.data.items;
}

/** POST /api/plant-report-items */
export async function createPlantReportItem(
  payload: SavePlantReportItemPayload,
): Promise<PlantReportItem> {
  const res = await api.post("/api/plant-report-items", payload);
  return res.data.item;
}

/** PUT /api/plant-report-items/:id */
export async function updatePlantReportItem(
  id: number,
  payload: SavePlantReportItemPayload,
): Promise<PlantReportItem> {
  const res = await api.put(`/api/plant-report-items/${id}`, payload);
  return res.data.item;
}

/** DELETE /api/plant-report-items/:id */
export async function deletePlantReportItem(id: number): Promise<void> {
  await api.delete(`/api/plant-report-items/${id}`);
}
