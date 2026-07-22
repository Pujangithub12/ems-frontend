import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useWorkspaceId } from "../../../hooks/useWorkspaceId";
import {
  fetchProcurementItems,
  fetchWorkspaceProcurement,
  createProcurementItem,
  updateProcurementItem,
  deleteProcurementItem,
  fetchProcurementItemDetail,
  uploadProcurementAttachment,
  deleteProcurementAttachment,
  ProcurementItemInput,
} from "../api/procurement.api";
import { ProcurementItem } from "../../../types";

/** Thin query-hook wrappers around procurementApi.ts, for the project Procurement tab. */
export function useProcurementItemsQuery(projectId: string) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.procurement(wsId, projectId),
    queryFn: () => fetchProcurementItems(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Aggregated across every project in the workspace, for the sidebar Procurement page. */
export function useWorkspaceProcurementQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceProcurement(wsId),
    queryFn: () => fetchWorkspaceProcurement(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateProcurementItemMutation() {
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: ProcurementItemInput }) =>
      createProcurementItem(projectId, input),
  });
}

export function useUpdateProcurementItemMutation() {
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: number;
      input: Partial<ProcurementItemInput> & { status?: ProcurementItem["status"] };
    }) => updateProcurementItem(itemId, input),
  });
}

export function useDeleteProcurementItemMutation() {
  return useMutation({
    mutationFn: (itemId: number) => deleteProcurementItem(itemId),
  });
}

/** The item-detail drawer payload — only fetched while the drawer is open. */
export function useProcurementItemDetailQuery(itemId: number | null) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.procurementItemDetail(wsId, itemId ?? -1),
    queryFn: () => fetchProcurementItemDetail(itemId as number),
    enabled: Number.isFinite(wsId) && !!itemId,
  });
}

export function useUploadProcurementAttachmentMutation() {
  return useMutation({
    mutationFn: ({ itemId, file }: { itemId: number; file: File }) =>
      uploadProcurementAttachment(itemId, file),
  });
}

export function useDeleteProcurementAttachmentMutation() {
  return useMutation({
    mutationFn: ({ itemId, attachmentId }: { itemId: number; attachmentId: number }) =>
      deleteProcurementAttachment(itemId, attachmentId),
  });
}
