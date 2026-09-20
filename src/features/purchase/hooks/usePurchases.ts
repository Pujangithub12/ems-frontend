import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchPurchaseBills,
  createPurchaseBill,
  updatePurchaseBill,
  deletePurchaseBill,
  importPurchaseBills,
  SavePurchaseBillPayload,
} from "../api/purchase.api";

/** Always loads the whole organization's bills — project/site/date/vendor
 * filtering happens client-side so switching filters is instant and the
 * summary cards can compare against the previous period from the same data. */
export function usePurchaseBillsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseBills(wsId),
    queryFn: () => fetchPurchaseBills(),
    enabled: Number.isFinite(wsId),
  });
}

function useInvalidateBills() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.purchaseBills(wsId) });
}

export function useCreatePurchaseBill() {
  const invalidate = useInvalidateBills();
  return useMutation({ mutationFn: (payload: SavePurchaseBillPayload) => createPurchaseBill(payload), onSuccess: invalidate });
}

export function useUpdatePurchaseBill() {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SavePurchaseBillPayload }) => updatePurchaseBill(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeletePurchaseBill() {
  const invalidate = useInvalidateBills();
  return useMutation({ mutationFn: (id: number) => deletePurchaseBill(id), onSuccess: invalidate });
}

export function useImportPurchaseBills() {
  const invalidate = useInvalidateBills();
  return useMutation({
    mutationFn: ({ projectId, rows }: { projectId: number; rows: Parameters<typeof importPurchaseBills>[1] }) =>
      importPurchaseBills(projectId, rows),
    onSuccess: invalidate,
  });
}
