import api from "../../../api/axios";

export type SiteActivityItemStatus = "ongoing" | "completed";
export type SiteActivityEquipmentCondition = "working" | "idle" | "breakdown";
export type SiteActivityReportStatus = "draft" | "submitted";
export type SiteActivityWeatherSlot = "morning" | "afternoon" | "evening";
export type SiteActivityRainfall = "no_rainfall" | "light" | "moderate" | "heavy";
export type SiteActivitySafetyType = "observation" | "incident";

export type SiteActivityItem = {
  id: number;
  description: string;
  chainage: string | null;
  todayQty: number | null;
  unit: string | null;
  status: SiteActivityItemStatus;
  remarks: string | null;
  photos: { id: number; filePath: string; fileName: string; caption: string | null }[];
};

export type SiteActivityEquipment = {
  id: number;
  equipmentName: string;
  quantity: number;
  workingHours: number | null;
  condition: SiteActivityEquipmentCondition;
  remarks: string | null;
};

export type SiteActivityManpower = {
  id: number;
  role: string;
  headcount: number;
  names: string | null;
  remarks: string | null;
};

export type SiteActivityPhoto = {
  id: number;
  itemId: number | null;
  filePath: string;
  fileName: string;
  caption: string | null;
  uploadedAt: string;
};

export type SiteActivityWeather = {
  id: number;
  slot: SiteActivityWeatherSlot;
  condition: string | null;
  tempC: number | null;
  rainfall: SiteActivityRainfall | null;
  remarks: string | null;
};

export type SiteActivityMaterial = {
  id: number;
  materialType: string;
  receivedQuantity: number | null;
  receivedUnit: string | null;
  usedQuantity: number | null;
  usedUnit: string | null;
  remarks: string | null;
};

export type SiteActivitySafety = {
  id: number;
  type: SiteActivitySafetyType;
  description: string | null;
  actionTaken: string | null;
};

export type SiteActivityInstruction = {
  id: number;
  description: string | null;
  byWhom: string | null;
  toWhom: string | null;
  time: string | null;
  signatureOf: string | null;
};

export type SiteActivityReport = {
  id: number;
  projectId: number;
  reportDate: string;
  location: string | null;
  reportDateBs: string | null;
  preparedBy: string | null;
  remarks: string | null;
  signedBy: string | null;
  status: SiteActivityReportStatus;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
  activities: SiteActivityItem[];
  equipment: SiteActivityEquipment[];
  manpower: SiteActivityManpower[];
  photos: SiteActivityPhoto[];
  weather: SiteActivityWeather[];
  materials: SiteActivityMaterial[];
  safety: SiteActivitySafety[];
  instructions: SiteActivityInstruction[];
};

export type SaveSiteActivityItemPayload = {
  description: string;
  chainage?: string | null;
  todayQty?: number | null;
  unit?: string | null;
  status?: SiteActivityItemStatus;
  remarks?: string | null;
};

export type SaveSiteActivityEquipmentPayload = {
  equipmentName: string;
  quantity?: number;
  workingHours?: number | null;
  condition?: SiteActivityEquipmentCondition;
  remarks?: string | null;
};

export type SaveSiteActivityManpowerPayload = {
  role: string;
  headcount?: number;
  names?: string | null;
  remarks?: string | null;
};

export type SaveSiteActivityWeatherPayload = {
  slot: SiteActivityWeatherSlot;
  condition?: string | null;
  tempC?: number | null;
  rainfall?: SiteActivityRainfall | null;
  remarks?: string | null;
};

export type SaveSiteActivityMaterialPayload = {
  materialType: string;
  receivedQuantity?: number | null;
  receivedUnit?: string | null;
  usedQuantity?: number | null;
  usedUnit?: string | null;
  remarks?: string | null;
};

export type SaveSiteActivitySafetyPayload = {
  type: SiteActivitySafetyType;
  description?: string | null;
  actionTaken?: string | null;
};

export type SaveSiteActivityInstructionPayload = {
  description?: string | null;
  byWhom?: string | null;
  toWhom?: string | null;
  time?: string | null;
  signatureOf?: string | null;
};

export type SaveSiteActivityReportPayload = {
  reportDate: string;
  location?: string | null;
  reportDateBs?: string | null;
  preparedBy?: string | null;
  remarks?: string | null;
  signedBy?: string | null;
  status?: SiteActivityReportStatus;
  activities: SaveSiteActivityItemPayload[];
  equipment: SaveSiteActivityEquipmentPayload[];
  manpower: SaveSiteActivityManpowerPayload[];
  weather: SaveSiteActivityWeatherPayload[];
  materials: SaveSiteActivityMaterialPayload[];
  safety: SaveSiteActivitySafetyPayload[];
  instructions: SaveSiteActivityInstructionPayload[];
};

export type SiteActivityOptionKind = "activity" | "equipment" | "material";

/** GET /api/site-activity-options?kind=... — the org's reusable predefined-options
 * vocabulary backing the Work Activities / Equipment / Materials tables' dropdowns.
 * Grows automatically as new values are saved — see saveSiteActivityReport. */
export async function fetchSiteActivityOptions(kind: SiteActivityOptionKind): Promise<string[]> {
  const res = await api.get("/api/site-activity-options", { params: { kind } });
  return res.data.options ?? [];
}

/** POST /api/site-activity-options — explicitly add a new option (the "+" popup
 * next to a select-only predefined-options dropdown). Returns the full updated
 * list for that kind so the new entry can be selected immediately. */
export async function addSiteActivityOption(kind: SiteActivityOptionKind, name: string): Promise<string[]> {
  const res = await api.post("/api/site-activity-options", { kind, name });
  return res.data.options ?? [];
}

/** GET /api/site-activity-reports?projectId&date — null if no report has
 * been filled in for that project+date yet. */
export async function fetchSiteActivityReport(projectId: number, date: string): Promise<SiteActivityReport | null> {
  const res = await api.get("/api/site-activity-reports", { params: { projectId, date } });
  return res.data.report;
}

/** GET /api/site-activity-reports/range?projectId&from&to — every report in
 * an inclusive date range (backs the Weekly Summary view); days with no
 * report simply have no entry. */
export async function fetchSiteActivityReportsRange(projectId: number, from: string, to: string): Promise<SiteActivityReport[]> {
  const res = await api.get("/api/site-activity-reports/range", { params: { projectId, from, to } });
  return res.data.reports;
}

/** POST /api/site-activity-reports?projectId — creates the report for
 * `payload.reportDate` if none exists yet, otherwise full-replaces it. */
export async function saveSiteActivityReport(
  projectId: number,
  payload: SaveSiteActivityReportPayload,
): Promise<SiteActivityReport> {
  const res = await api.post("/api/site-activity-reports", payload, { params: { projectId } });
  return res.data.report;
}

/** DELETE /api/site-activity-reports/:id */
export async function deleteSiteActivityReport(id: number): Promise<void> {
  await api.delete(`/api/site-activity-reports/${id}`);
}

/** POST /api/site-activity-reports/:reportId/photos (multipart) */
export async function uploadSiteActivityPhoto(
  reportId: number,
  file: File,
  opts?: { itemId?: number; caption?: string },
): Promise<SiteActivityPhoto> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.itemId != null) form.append("itemId", String(opts.itemId));
  if (opts?.caption) form.append("caption", opts.caption);
  const res = await api.post(`/api/site-activity-reports/${reportId}/photos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.photo;
}

/** DELETE /api/site-activity-photos/:id */
export async function deleteSiteActivityPhoto(id: number): Promise<void> {
  await api.delete(`/api/site-activity-photos/${id}`);
}
