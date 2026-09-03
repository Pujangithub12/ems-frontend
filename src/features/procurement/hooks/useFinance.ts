import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchFinanceOverview,
  fetchExchangeRates,
  fetchVendorFinanceSummary,
  fetchItemCostReport,
  addPurchaseOrderPayment,
  deletePurchaseOrderPayment,
  createFinanceManualRecord,
  updateFinanceManualRecord,
  deleteFinanceManualRecord,
  addManualRecordPayment,
  deleteManualRecordPayment,
  fetchFinanceCostBreakdown,
  updateCostBreakdownRow,
  AddPurchaseOrderPaymentInput,
  SaveFinanceManualRecordInput,
  EditCostBreakdownRowInput,
} from "../api/finance.api";

export function useFinanceOverviewQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.financeOverview(wsId),
    queryFn: () => fetchFinanceOverview(),
    enabled: Number.isFinite(wsId),
  });
}

/** Today's exchange rates — one NRB rate per day, so cache generously; refetching every mount
 * would just re-serve the backend's own daily cache anyway. */
export function useExchangeRatesQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.exchangeRates(wsId),
    queryFn: () => fetchExchangeRates(),
    enabled: Number.isFinite(wsId),
    staleTime: 60 * 60 * 1000,
  });
}

export function useVendorFinanceSummaryQuery(vendorId: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.vendorFinanceSummary(wsId, vendorId ?? -1),
    queryFn: () => fetchVendorFinanceSummary(vendorId as number),
    enabled: Number.isFinite(wsId) && !!vendorId,
  });
}

export function useItemCostReportQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.itemCostReport(wsId),
    queryFn: () => fetchItemCostReport(),
    enabled: Number.isFinite(wsId),
  });
}

export function useAddPurchaseOrderPaymentMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AddPurchaseOrderPaymentInput }) =>
      addPurchaseOrderPayment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCostReport(wsId) });
    },
  });
}

export function useDeletePurchaseOrderPaymentMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentId }: { id: number; paymentId: number }) => deletePurchaseOrderPayment(id, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCostReport(wsId) });
    },
  });
}

export function useCreateFinanceManualRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveFinanceManualRecordInput) => createFinanceManualRecord(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
    },
  });
}

export function useUpdateFinanceManualRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SaveFinanceManualRecordInput }) => updateFinanceManualRecord(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
    },
  });
}

export function useDeleteFinanceManualRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFinanceManualRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
    },
  });
}

/** Logs a payment against either a PO or a manual record, dispatching to the right endpoint by
 * `row.source` — the Finance/VendorFinance pages use one modal for both row kinds. */
export function useAddFinanceRowPaymentMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, id, input }: { source: "po" | "manual"; id: number; input: AddPurchaseOrderPaymentInput }) => {
      if (source === "po") await addPurchaseOrderPayment(id, input);
      else await addManualRecordPayment(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCostReport(wsId) });
    },
  });
}

/** Deletes a logged payment from either a PO or a manual record, dispatching by `source`. */
export function useDeleteFinanceRowPaymentMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, id, paymentId }: { source: "po" | "manual"; id: number; paymentId: number }) => {
      if (source === "po") await deletePurchaseOrderPayment(id, paymentId);
      else await deleteManualRecordPayment(id, paymentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCostReport(wsId) });
    },
  });
}

/** The per-item cost breakdown page reached by clicking a Finance row. */
export function useFinanceCostBreakdownQuery(source: "po" | "manual" | null, id: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.financeCostBreakdown(wsId, source ?? "po", id ?? -1),
    queryFn: () => fetchFinanceCostBreakdown(source as "po" | "manual", id as number),
    enabled: Number.isFinite(wsId) && !!source && !!id,
  });
}

/** Saves a full row's edits (item name, major cost, freight, LC fields, VAT, remarks) on the
 * cost-breakdown page — for a "po" row this is one PurchaseOrderItem; for "manual" it's the
 * record's single line. */
export function useUpdateCostBreakdownRowMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      source,
      id,
      input,
      itemId,
    }: {
      source: "po" | "manual";
      id: number;
      input: EditCostBreakdownRowInput;
      itemId?: number | null;
    }) => updateCostBreakdownRow(source, id, input, itemId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.financeCostBreakdown(wsId, variables.source, variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(wsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.itemCostReport(wsId) });
    },
  });
}
