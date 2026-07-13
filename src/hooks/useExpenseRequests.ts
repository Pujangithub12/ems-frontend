import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  getExpenseRequests,
  createExpenseRequest,
  updateExpenseRequestStatus,
  CreateExpenseRequestPayload,
} from "../services/expenseRequests.service";

export function useExpenseRequests() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.expenseRequests(wsId),
    queryFn: getExpenseRequests,
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateExpenseRequest() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExpenseRequestPayload) => createExpenseRequest(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests(wsId) });
    },
  });
}

export function useUpdateExpenseRequestStatus() {
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      updateExpenseRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenseRequests(wsId) });
    },
  });
}
