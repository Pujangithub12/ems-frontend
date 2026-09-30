import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { fetchAllQuotations, createQuotation, updateQuotation, deleteQuotation, QuotationInput } from "../api/quotation.api";

/** Every quotation in the organization, for the sidebar Quotations page. */
export function useAllQuotationsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.allQuotations(wsId),
    queryFn: () => fetchAllQuotations(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateQuotationMutation() {
  return useMutation({
    mutationFn: (input: QuotationInput) => createQuotation(input),
  });
}

export function useUpdateQuotationMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<QuotationInput> }) => updateQuotation(id, input),
  });
}

export function useDeleteQuotationMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteQuotation(id),
  });
}
