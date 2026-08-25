import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchPurchaseOrders,
  fetchOrganizationPurchaseOrders,
  fetchPurchaseOrderDetail,
  createPurchaseOrder,
  updatePurchaseOrder,
  decidePurchaseOrderApproval,
  fetchCostSheet,
  PurchaseOrderInput,
  CreatePurchaseOrderInput,
} from "../api/purchaseOrder.api";

/** Thin query-hook wrappers around purchaseOrder.api.ts. */
export function usePurchaseOrdersQuery(projectId: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseOrders(wsId, projectId),
    queryFn: () => fetchPurchaseOrders(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Aggregated across every project in the organization, for the sidebar Purchase Orders page. */
export function useOrganizationPurchaseOrdersQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationPurchaseOrders(wsId),
    queryFn: () => fetchOrganizationPurchaseOrders(),
    enabled: Number.isFinite(wsId),
  });
}

export function usePurchaseOrderDetailQuery(id: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseOrderDetail(wsId, id ?? -1),
    queryFn: () => fetchPurchaseOrderDetail(id as number),
    enabled: Number.isFinite(wsId) && !!id,
  });
}

export function useCreatePurchaseOrderMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: CreatePurchaseOrderInput }) =>
      createPurchaseOrder(projectId, input),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders(wsId, projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationPurchaseOrders(wsId) });
    },
  });
}

export function useUpdatePurchaseOrderMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PurchaseOrderInput }) => updatePurchaseOrder(id, input),
  });
}

export function useDecidePurchaseOrderApprovalMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: "approved" | "rejected" }) =>
      decidePurchaseOrderApproval(id, decision),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrderDetail(wsId, id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationPurchaseOrders(wsId) });
    },
  });
}

export function useCostSheetQuery(id: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseOrderCostSheet(wsId, id ?? -1),
    queryFn: () => fetchCostSheet(id as number),
    enabled: Number.isFinite(wsId) && !!id,
  });
}
