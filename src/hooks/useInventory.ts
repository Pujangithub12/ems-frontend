import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import { useWorkspaceId } from "./useWorkspaceId";
import {
  fetchInventoryItems,
  fetchWorkspaceInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  fetchInventoryItemDetail,
  adjustInventoryStock,
  createStockTransfer,
  updateStockTransferStatus,
  addInventoryBatch,
  deleteInventoryBatch,
  addInventorySerial,
  deleteInventorySerial,
  uploadInventoryAttachment,
  deleteInventoryAttachment,
  fetchWorkspaceWarehouses,
  createWarehouse,
  fetchWorkspacePendingTransfers,
  fetchWorkspaceInventoryTransactions,
  fetchWorkspaceVendors,
  createVendor,
  updateVendor,
  InventoryItemInput,
} from "../project-components/inventoryApi";
import { InventorySerial } from "../types";

/** Thin query-hook wrappers around inventoryApi.ts, for the project Inventory tab. */
export function useInventoryItemsQuery(projectId: string) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.inventory(wsId, projectId),
    queryFn: () => fetchInventoryItems(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Aggregated across every project in the workspace, for the sidebar Inventory page. */
export function useWorkspaceInventoryQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceInventory(wsId),
    queryFn: () => fetchWorkspaceInventory(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateInventoryItemMutation() {
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: InventoryItemInput }) =>
      createInventoryItem(projectId, input),
  });
}

export function useUpdateInventoryItemMutation() {
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: Partial<InventoryItemInput> }) =>
      updateInventoryItem(itemId, input),
  });
}

export function useDeleteInventoryItemMutation() {
  return useMutation({
    mutationFn: (itemId: number) => deleteInventoryItem(itemId),
  });
}

/** The item-detail drawer payload — only fetched while the drawer is open. */
export function useInventoryItemDetailQuery(itemId: number | null) {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.inventoryItemDetail(wsId, itemId ?? -1),
    queryFn: () => fetchInventoryItemDetail(itemId as number),
    enabled: Number.isFinite(wsId) && !!itemId,
  });
}

export function useAdjustInventoryStockMutation() {
  return useMutation({
    mutationFn: ({ itemId, delta, reason }: { itemId: number; delta: number; reason?: string }) =>
      adjustInventoryStock(itemId, delta, reason),
  });
}

export function useCreateStockTransferMutation() {
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: number;
      input: { fromWarehouseId?: number; toWarehouseId: number; quantity: number; notes?: string };
    }) => createStockTransfer(itemId, input),
  });
}

export function useUpdateStockTransferStatusMutation() {
  return useMutation({
    mutationFn: ({
      itemId,
      transferId,
      status,
    }: {
      itemId: number;
      transferId: number;
      status: "pending" | "in_transit" | "completed" | "cancelled";
    }) => updateStockTransferStatus(itemId, transferId, status),
  });
}

export function useAddInventoryBatchMutation() {
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: number;
      input: { batchNumber: string; quantity?: number; manufactureDate?: string; expiryDate?: string };
    }) => addInventoryBatch(itemId, input),
  });
}

export function useDeleteInventoryBatchMutation() {
  return useMutation({
    mutationFn: ({ itemId, batchId }: { itemId: number; batchId: number }) =>
      deleteInventoryBatch(itemId, batchId),
  });
}

export function useAddInventorySerialMutation() {
  return useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: number;
      input: { serialNumber: string; status?: InventorySerial["status"]; warrantyExpiryDate?: string; notes?: string };
    }) => addInventorySerial(itemId, input),
  });
}

export function useDeleteInventorySerialMutation() {
  return useMutation({
    mutationFn: ({ itemId, serialId }: { itemId: number; serialId: number }) =>
      deleteInventorySerial(itemId, serialId),
  });
}

export function useUploadInventoryAttachmentMutation() {
  return useMutation({
    mutationFn: ({ itemId, file }: { itemId: number; file: File }) =>
      uploadInventoryAttachment(itemId, file),
  });
}

export function useDeleteInventoryAttachmentMutation() {
  return useMutation({
    mutationFn: ({ itemId, attachmentId }: { itemId: number; attachmentId: number }) =>
      deleteInventoryAttachment(itemId, attachmentId),
  });
}

export function useWorkspaceWarehousesQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceWarehouses(wsId),
    queryFn: () => fetchWorkspaceWarehouses(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateWarehouseMutation() {
  return useMutation({
    mutationFn: (input: { name: string; code?: string; location?: string; capacity?: number }) =>
      createWarehouse(input),
  });
}

export function useUpdateVendorMutation() {
  return useMutation({
    mutationFn: ({
      vendorId,
      input,
    }: {
      vendorId: number;
      input: { name?: string; code?: string; location?: string; rating?: number | null; contractExpiryDate?: string | null };
    }) => updateVendor(vendorId, input),
  });
}

export function useWorkspacePendingTransfersQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspacePendingTransfers(wsId),
    queryFn: () => fetchWorkspacePendingTransfers(),
    enabled: Number.isFinite(wsId),
  });
}

export function useWorkspaceInventoryTransactionsQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceInventoryTransactions(wsId),
    queryFn: () => fetchWorkspaceInventoryTransactions(),
    enabled: Number.isFinite(wsId),
  });
}

export function useWorkspaceVendorsQuery() {
  const wsId = useWorkspaceId();
  return useQuery({
    queryKey: queryKeys.workspaceVendors(wsId),
    queryFn: () => fetchWorkspaceVendors(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateVendorMutation() {
  return useMutation({
    mutationFn: (input: { name: string; code?: string; location?: string; rating?: number; contractExpiryDate?: string }) =>
      createVendor(input),
  });
}
