import api from "../api/axios";

export type ExpenseRequest = {
  id: number;
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
};

export type CreateExpenseRequestPayload = {
  title: string;
  amount: number;
  category: string;
  expenseDate: string;
  reason: string;
};

/** GET /api/expense */
export async function getExpenseRequests(): Promise<ExpenseRequest[]> {
  const res = await api.get<ExpenseRequest[]>("/api/expense");
  return res.data;
}

/** POST /api/expense */
export async function createExpenseRequest(
  payload: CreateExpenseRequestPayload,
): Promise<void> {
  await api.post("/api/expense", payload);
}

/** PUT /api/expense/:id/status */
export async function updateExpenseRequestStatus(
  id: number,
  status: "approved" | "rejected",
): Promise<void> {
  await api.put(`/api/expense/${id}/status`, { status });
}
