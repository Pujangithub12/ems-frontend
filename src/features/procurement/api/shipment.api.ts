import api from "../../../api/axios";
import { Shipment, ShipmentTransportMode, ShipmentStatus, Insurance, Customs, CustomsDocumentType, LetterOfCredit } from "../../../types";

export interface ShipmentInput {
  shipmentNo?: string;
  transportMode?: ShipmentTransportMode;
  transportCompany?: string;
  containerNo?: string;
  vehicleNo?: string;
  trackingNo?: string;
  etd?: string;
  eta?: string;
  arrivalDate?: string;
  status?: ShipmentStatus;
  freightCost?: number;
  loadingCost?: number;
  unloadingCost?: number;
  fuelCost?: number;
  miscellaneousCost?: number;
  localTaxCost?: number;
}

export interface InsuranceInput {
  insuranceCompany?: string;
  policyNumber?: string;
  coverage?: number;
  premium?: number;
  claimStatus?: string;
}

export interface CustomsInput {
  customDeclarationNumber?: string;
  billOfEntry?: string;
  hsCode?: string;
  clearingAgent?: string;
  port?: string;
  importDuty?: number;
  vat?: number;
  excise?: number;
  serviceCharge?: number;
  documentationCost?: number;
  inspectionCost?: number;
  warehouseCost?: number;
  miscellaneousCost?: number;
}

/** POST create the (single, per-PO) shipment. */
export async function createShipment(purchaseOrderId: number, input: ShipmentInput): Promise<Shipment> {
  const res = await api.post<{ shipment: Shipment }>(`/api/purchase-orders/${purchaseOrderId}/shipment`, input);
  return res.data.shipment;
}

/** PUT update shipment fields. */
export async function updateShipment(id: number, input: Partial<ShipmentInput>): Promise<Shipment> {
  const res = await api.put<{ shipment: Shipment }>(`/api/shipments/${id}`, input);
  return res.data.shipment;
}

/** POST add insurance to a shipment ("only if applicable"). */
export async function createInsurance(shipmentId: number, input: InsuranceInput): Promise<Insurance> {
  const res = await api.post<{ insurance: Insurance }>(`/api/shipments/${shipmentId}/insurance`, input);
  return res.data.insurance;
}

/** PUT update insurance fields. */
export async function updateInsurance(id: number, input: Partial<InsuranceInput>): Promise<Insurance> {
  const res = await api.put<{ insurance: Insurance }>(`/api/insurance/${id}`, input);
  return res.data.insurance;
}

export interface LetterOfCreditInput {
  lcNumber?: string;
  lcCharge?: number;
  lcCommission?: number;
}

/** PUT create-or-update the (single, per-shipment) letter of credit ("only if applicable"). */
export async function saveLetterOfCredit(shipmentId: number, input: LetterOfCreditInput): Promise<LetterOfCredit> {
  const res = await api.put<{ letterOfCredit: LetterOfCredit }>(
    `/api/shipments/${shipmentId}/letter-of-credit`,
    input,
  );
  return res.data.letterOfCredit;
}

/** POST add customs to a shipment (international purchases). */
export async function createCustoms(shipmentId: number, input: CustomsInput): Promise<Customs> {
  const res = await api.post<{ customs: Customs }>(`/api/shipments/${shipmentId}/customs`, input);
  return res.data.customs;
}

/** PUT update customs fields. */
export async function updateCustoms(id: number, input: Partial<CustomsInput>): Promise<Customs> {
  const res = await api.put<{ customs: Customs }>(`/api/customs/${id}`, input);
  return res.data.customs;
}

/** POST upload a customs supporting document, multipart. */
export async function uploadCustomsDocument(
  customsId: number,
  file: File,
  documentType: CustomsDocumentType = "other",
): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);
  await api.post(`/api/customs/${customsId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/** DELETE a customs document. */
export async function deleteCustomsDocument(customsId: number, documentId: number): Promise<void> {
  await api.delete(`/api/customs/${customsId}/documents/${documentId}`);
}
