import api from "../../../api/axios";

export type SiteVisitRequest = {
  id: number;
  title: string;
  location: string;
  visitDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type CreateSiteVisitRequestPayload = {
  title: string;
  location: string;
  visitDate: string;
  reason: string;
};

/** GET /api/sitevisit */
export async function getSiteVisitRequests(): Promise<SiteVisitRequest[]> {
  const res = await api.get<SiteVisitRequest[]>("/api/sitevisit");
  return res.data;
}

/** POST /api/sitevisit */
export async function createSiteVisitRequest(
  payload: CreateSiteVisitRequestPayload,
): Promise<void> {
  await api.post("/api/sitevisit", payload);
}

/** PUT /api/sitevisit/:id/status */
export async function updateSiteVisitRequestStatus(
  id: number,
  status: "approved" | "rejected",
): Promise<void> {
  await api.put(`/api/sitevisit/${id}/status`, { status });
}
