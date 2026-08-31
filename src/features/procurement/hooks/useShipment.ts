import { useMutation } from "@tanstack/react-query";
import {
  createShipment,
  updateShipment,
  createInsurance,
  updateInsurance,
  saveLetterOfCredit,
  createCustoms,
  updateCustoms,
  uploadCustomsDocument,
  deleteCustomsDocument,
  ShipmentInput,
  InsuranceInput,
  LetterOfCreditInput,
  CustomsInput,
} from "../api/shipment.api";
import { CustomsDocumentType } from "../../../types";

/** Thin mutation-hook wrappers around shipment.api.ts — Shipment/Insurance/Customs are all fetched as part of the PO detail payload, these just mutate and the caller refetches the PO. */
export function useCreateShipmentMutation() {
  return useMutation({
    mutationFn: ({ purchaseOrderId, input }: { purchaseOrderId: number; input: ShipmentInput }) =>
      createShipment(purchaseOrderId, input),
  });
}

export function useUpdateShipmentMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ShipmentInput> }) => updateShipment(id, input),
  });
}

export function useCreateInsuranceMutation() {
  return useMutation({
    mutationFn: ({ shipmentId, input }: { shipmentId: number; input: InsuranceInput }) =>
      createInsurance(shipmentId, input),
  });
}

export function useUpdateInsuranceMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<InsuranceInput> }) => updateInsurance(id, input),
  });
}

export function useSaveLetterOfCreditMutation() {
  return useMutation({
    mutationFn: ({ shipmentId, input }: { shipmentId: number; input: LetterOfCreditInput }) =>
      saveLetterOfCredit(shipmentId, input),
  });
}

export function useCreateCustomsMutation() {
  return useMutation({
    mutationFn: ({ shipmentId, input }: { shipmentId: number; input: CustomsInput }) =>
      createCustoms(shipmentId, input),
  });
}

export function useUpdateCustomsMutation() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CustomsInput> }) => updateCustoms(id, input),
  });
}

export function useUploadCustomsDocumentMutation() {
  return useMutation({
    mutationFn: ({
      customsId,
      file,
      documentType,
    }: {
      customsId: number;
      file: File;
      documentType?: CustomsDocumentType;
    }) => uploadCustomsDocument(customsId, file, documentType),
  });
}

export function useDeleteCustomsDocumentMutation() {
  return useMutation({
    mutationFn: ({ customsId, documentId }: { customsId: number; documentId: number }) =>
      deleteCustomsDocument(customsId, documentId),
  });
}
