import api from "../../../api/axios";

export type PlantReportStaffMember = { id: number; fullName: string };
export type PlantReportProject = { id: number; name: string };

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
  staff: PlantReportStaffMember[];
  staffCount: number;
  createdBy: PlantReportStaffMember | null;
  createdAt: string;
  updatedAt: string;
};

export type PlantReportSummary = {
  totalSteamTon: number | null;
  avgSteamPressure: number | null;
  avgSteamTemp: number | null;
  totalPelletUsedKg: number | null;
  totalPelletReceivedKg: number | null;
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
  | { exists: false; openingBalance: number };

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
