import { useMutation } from "@tanstack/react-query";
import {
  createProformaInvoice,
  updateProformaInvoice,
  deleteProformaInvoice,
  changeProformaInvoiceStatus,
  uploadProformaInvoiceFile,
  ProformaInvoiceInput,
} from "../api/proformaInvoice.api";
import { ProformaInvoiceStatus } from "../../../types";

/** Thin mutation-hook wrappers around proformaInvoice.api.ts — the PO detail page owns the query (fetched as part of PO detail), these just mutate and the caller refetches the PO. */
export function useCreateProformaInvoiceMutation() {
  return useMutation({
    mutationFn: ({ purchaseOrderId, input }: { purchaseOrderId: number; input: ProformaInvoiceInput }) =>
      createProformaInvoice(purchaseOrderId, input),
  });
}

export function useUpdateProformaInvoiceMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ProformaInvoiceInput> }) =>
      updateProformaInvoice(id, input),
  });
}

export function useDeleteProformaInvoiceMutation() {
  return useMutation({
    mutationFn: (id: number) => deleteProformaInvoice(id),
  });
}

export function useChangeProformaInvoiceStatusMutation() {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ProformaInvoiceStatus }) =>
      changeProformaInvoiceStatus(id, status),
  });
}

export function useUploadProformaInvoiceFileMutation() {
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadProformaInvoiceFile(id, file),
  });
}
