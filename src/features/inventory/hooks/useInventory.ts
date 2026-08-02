import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchInventoryItems,
  fetchOrganizationInventory,
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
  fetchOrganizationWarehouses,
  createWarehouse,
  deleteWarehouse,
  fetchOrganizationPendingTransfers,
  fetchOrganizationInventoryTransactions,
  fetchOrganizationVendors,
  createVendor,
  updateVendor,
  deleteVendor,
  fetchOrganizationItems,
  createCatalogItem,
  InventoryItemInput,
} from "../api/inventory.api";
import { InventorySerial } from "../../../types";

/** Thin query-hook wrappers around inventoryApi.ts, for the project Inventory tab. */
export function useInventoryItemsQuery(projectId: string) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.inventory(wsId, projectId),
    queryFn: () => fetchInventoryItems(projectId),
    enabled: Number.isFinite(wsId) && !!projectId,
  });
}

/** Aggregated across every project in the organization, for the sidebar Inventory page. */
export function useOrganizationInventoryQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationInventory(wsId),
    queryFn: () => fetchOrganizationInventory(),
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
  const wsId = useOrganizationId();
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

export function useOrganizationWarehousesQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationWarehouses(wsId),
    queryFn: () => fetchOrganizationWarehouses(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateWarehouseMutation() {
  return useMutation({
    mutationFn: (input: { name: string; code?: string; location?: string; capacity?: number }) =>
      createWarehouse(input),
  });
}

export function useDeleteWarehouseMutation() {
  return useMutation({
    mutationFn: (warehouseId: number) => deleteWarehouse(warehouseId),
  });
}

export function useUpdateVendorMutation() {
  return useMutation({
    mutationFn: ({
      vendorId,
      input,
    }: {
      vendorId: number;
      input: {
        name?: string;
        code?: string;
        location?: string;
        contact?: string;
        contractExpiryDate?: string | null;
        contactPerson?: string;
        address?: string;
        email?: string;
      };
    }) => updateVendor(vendorId, input),
  });
}

export function useOrganizationPendingTransfersQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationPendingTransfers(wsId),
    queryFn: () => fetchOrganizationPendingTransfers(),
    enabled: Number.isFinite(wsId),
  });
}

export function useOrganizationInventoryTransactionsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationInventoryTransactions(wsId),
    queryFn: () => fetchOrganizationInventoryTransactions(),
    enabled: Number.isFinite(wsId),
  });
}

export function useOrganizationVendorsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationVendors(wsId),
    queryFn: () => fetchOrganizationVendors(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateVendorMutation() {
  return useMutation({
    mutationFn: (input: {
      name: string;
      code?: string;
      location?: string;
      contact?: string;
      contractExpiryDate?: string;
      contactPerson?: string;
      address?: string;
      email?: string;
    }) => createVendor(input),
  });
}

export function useDeleteVendorMutation() {
  return useMutation({
    mutationFn: (vendorId: number) => deleteVendor(vendorId),
  });
}

/** The shared item catalog — used by both the Inventory and Procurement "Add item" forms to keep item naming consistent. */
export function useOrganizationItemCatalogQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.organizationItemCatalog(wsId),
    queryFn: () => fetchOrganizationItems(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateCatalogItemMutation() {
  return useMutation({
    mutationFn: (input: { name: string; code?: string }) => createCatalogItem(input),
  });
}
