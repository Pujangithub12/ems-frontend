import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchPurchaseRequests,
  fetchOrganizationPurchaseRequests,
  createPurchaseRequest,
  updatePurchaseRequest,
  deletePurchaseRequest,
  fetchPurchaseRequestDetail,
  changePurchaseRequestStatus,
  addVendorQuote,
  updateVendorQuote,
  deleteVendorQuote,
  selectVendorQuote,
  generatePurchaseOrder,
  uploadPurchaseRequestAttachment,
  deletePurchaseRequestAttachment,
  PurchaseRequestInput,
} from "../api/purchaseRequest.api";
import { PurchaseRequestStatus, PurchaseRequestAttachmentType } from "../../../types";

/** Thin query-hook wrappers around purchaseRequest.api.ts, for the project Purchase Requests tab. */
export function usePurchaseRequestsQuery(projectId: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseRequests(wsId, projectId),
    queryFn: () => fetchPurchaseRequests(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Aggregated across every project in the organization, for the sidebar Purchase Requests page. */
export function useOrganizationPurchaseRequestsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationPurchaseRequests(wsId),
    queryFn: () => fetchOrganizationPurchaseRequests(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreatePurchaseRequestMutation() {
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: PurchaseRequestInput }) =>
      createPurchaseRequest(projectId, input),
  });
}

export function useUpdatePurchaseRequestMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<PurchaseRequestInput> }) =>
      updatePurchaseRequest(id, input),
  });
}

export function useDeletePurchaseRequestMutation() {
  return useMutation({
    mutationFn: (id: number) => deletePurchaseRequest(id),
  });
}

export function usePurchaseRequestDetailQuery(id: number | null) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.purchaseRequestDetail(wsId, id ?? -1),
    queryFn: () => fetchPurchaseRequestDetail(id as number),
    enabled: Number.isFinite(wsId) && !!id,
  });
}

export function useChangePurchaseRequestStatusMutation() {
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: PurchaseRequestStatus; notes?: string }) =>
      changePurchaseRequestStatus(id, status, notes),
  });
}

export function useAddVendorQuoteMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: { vendorId: number; price: number; notes?: string } }) =>
      addVendorQuote(id, input),
  });
}

export function useUpdateVendorQuoteMutation() {
  return useMutation({
    mutationFn: ({
      id,
      quoteId,
      input,
    }: {
      id: number;
      quoteId: number;
      input: { vendorId?: number; price?: number; notes?: string };
    }) => updateVendorQuote(id, quoteId, input),
  });
}

export function useDeleteVendorQuoteMutation() {
  return useMutation({
    mutationFn: ({ id, quoteId }: { id: number; quoteId: number }) => deleteVendorQuote(id, quoteId),
  });
}

export function useSelectVendorQuoteMutation() {
  return useMutation({
    mutationFn: ({ id, quoteId }: { id: number; quoteId: number }) => selectVendorQuote(id, quoteId),
  });
}

export function useGeneratePurchaseOrderMutation() {
  return useMutation({
    mutationFn: (id: number) => generatePurchaseOrder(id),
  });
}

export function useUploadPurchaseRequestAttachmentMutation() {
  return useMutation({
    mutationFn: ({
      id,
      file,
      documentType,
    }: {
      id: number;
      file: File;
      documentType?: PurchaseRequestAttachmentType;
    }) => uploadPurchaseRequestAttachment(id, file, documentType),
  });
}

export function useDeletePurchaseRequestAttachmentMutation() {
  return useMutation({
    mutationFn: ({ id, attachmentId }: { id: number; attachmentId: number }) =>
      deletePurchaseRequestAttachment(id, attachmentId),
  });
}
