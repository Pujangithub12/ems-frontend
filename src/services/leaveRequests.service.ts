import api from "../api/axios";

export type LeaveRequest = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  historyCount?: number;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type CreateLeaveRequestPayload = {
  title: string;
  startDate: string;
  endDate: string;
  reason: string;
};

/** GET /api/leaverequest */
export async function getLeaveRequests(): Promise<LeaveRequest[]> {
  const res = await api.get<LeaveRequest[]>("/api/leaverequest");
  return res.data;
}

/** POST /api/leaverequest */
export async function createLeaveRequest(
  payload: CreateLeaveRequestPayload,
): Promise<void> {
  await api.post("/api/leaverequest", payload);
}

/** PUT /api/leaverequest/:id/status */
export async function updateLeaveRequestStatus(
  id: number,
  status: "approved" | "rejected",
): Promise<void> {
  await api.put(`/api/leaverequest/${id}/status`, { status });
}
