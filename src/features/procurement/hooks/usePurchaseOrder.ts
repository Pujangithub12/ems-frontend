import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchPurchaseOrders,
  fetchOrganizationPurchaseOrders,
  fetchPurchaseOrderDetail,
  updatePurchaseOrder,
  fetchCostSheet,
  uploadPurchaseOrderAttachment,
  deletePurchaseOrderAttachment,
  PurchaseOrderInput,
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

export function useUpdatePurchaseOrderMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: PurchaseOrderInput }) => updatePurchaseOrder(id, input),
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

export function useUploadPurchaseOrderAttachmentMutation() {
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadPurchaseOrderAttachment(id, file),
  });
}

export function useDeletePurchaseOrderAttachmentMutation() {
  return useMutation({
    mutationFn: ({ id, attachmentId }: { id: number; attachmentId: number }) =>
      deletePurchaseOrderAttachment(id, attachmentId),
  });
}
