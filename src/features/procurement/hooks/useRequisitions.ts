import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { fetchRequisitions, createRequisition, updateRequisition, deleteRequisition } from "../api/requisition.api";
import type { RequisitionFormData } from "../pdf/generatePdf";

export function useRequisitionsQuery(enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.requisitions(wsId),
    queryFn: fetchRequisitions,
    enabled: enabled && Number.isFinite(wsId),
  });
}

/** Saves the form: creates the requisition the first time, updates it afterwards. */
export function useSaveRequisitionMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number | null; data: RequisitionFormData }) => (id == null ? createRequisition(data) : updateRequisition(id, data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.requisitions(wsId) }),
  });
}

export function useDeleteRequisitionMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteRequisition(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.requisitions(wsId) }),
  });
}
