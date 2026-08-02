import { useMutation } from "@tanstack/react-query";
import {
  createGoodsReceipt,
  updateGoodsReceiptStatus,
  uploadGoodsReceiptPhoto,
  deleteGoodsReceiptPhoto,
  GoodsReceiptInput,
} from "../api/goodsReceipt.api";
import { GoodsReceiptStatus } from "../../../types";

/** Thin mutation-hook wrappers around goodsReceipt.api.ts — GRNs are fetched as part of the PO detail payload, these just mutate and the caller refetches the PO. */
export function useCreateGoodsReceiptMutation() {
  return useMutation({
    mutationFn: ({ purchaseOrderId, input }: { purchaseOrderId: number; input: GoodsReceiptInput }) =>
      createGoodsReceipt(purchaseOrderId, input),
  });
}

export function useUpdateGoodsReceiptStatusMutation() {
  return useMutation({
    mutationFn: ({
      id,
      status,
      inspectionResult,
    }: {
      id: number;
      status: GoodsReceiptStatus;
      inspectionResult?: string;
    }) => updateGoodsReceiptStatus(id, status, inspectionResult),
  });
}

export function useUploadGoodsReceiptPhotoMutation() {
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadGoodsReceiptPhoto(id, file),
  });
}

export function useDeleteGoodsReceiptPhotoMutation() {
  return useMutation({
    mutationFn: ({ id, photoId }: { id: number; photoId: number }) => deleteGoodsReceiptPhoto(id, photoId),
  });
}
