import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchDebtors,
  createDebtor,
  updateDebtor,
  deleteDebtor,
  addDebtorPayment,
  deleteDebtorPayment,
  fetchDebtorDetail,
  createDebtorClaim,
  updateDebtorClaim,
  deleteDebtorClaim,
  SaveDebtorClaimInput,
  SaveDebtorInput,
  AddDebtorPaymentInput,
} from "../api/debtor.api";

export function useDebtorsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.debtors(wsId),
    queryFn: fetchDebtors,
    enabled: Number.isFinite(wsId),
  });
}

/** Every debtor mutation refreshes the one list query. */
function useDebtorMutation<TVars>(fn: (vars: TVars) => Promise<unknown>) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.debtors(wsId) }),
  });
}

export const useCreateDebtorMutation = () => useDebtorMutation((input: SaveDebtorInput) => createDebtor(input));
export const useUpdateDebtorMutation = () =>
  useDebtorMutation(({ id, input }: { id: number; input: SaveDebtorInput }) => updateDebtor(id, input));
export const useDeleteDebtorMutation = () => useDebtorMutation((id: number) => deleteDebtor(id));
export const useAddDebtorPaymentMutation = () =>
  useDebtorMutation(({ id, input }: { id: number; input: AddDebtorPaymentInput }) => addDebtorPayment(id, input));
export const useDeleteDebtorPaymentMutation = () =>
  useDebtorMutation(({ id, paymentId }: { id: number; paymentId: number }) => deleteDebtorPayment(id, paymentId));

export function useDebtorDetailQuery(id: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.debtorDetail(wsId, id ?? -1),
    queryFn: () => fetchDebtorDetail(id as number),
    enabled: Number.isFinite(wsId) && !!id,
  });
}

/** Claim-line mutations refresh the debtor's detail page. */
function useClaimMutation<TVars extends { id: number }, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (_d, vars) => queryClient.invalidateQueries({ queryKey: queryKeys.debtorDetail(wsId, vars.id) }),
  });
}

export const useCreateDebtorClaimMutation = () =>
  useClaimMutation(({ id, input }: { id: number; input: SaveDebtorClaimInput }) => createDebtorClaim(id, input));
export const useUpdateDebtorClaimMutation = () =>
  useClaimMutation(({ id, claimId, input }: { id: number; claimId: number; input: SaveDebtorClaimInput }) => updateDebtorClaim(id, claimId, input));
export const useDeleteDebtorClaimMutation = () =>
  useClaimMutation(({ id, claimId }: { id: number; claimId: number }) => deleteDebtorClaim(id, claimId));
