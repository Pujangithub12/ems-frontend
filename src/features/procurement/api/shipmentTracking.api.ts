import api from "../../../api/axios";
import { ShipmentTrackingRecord } from "../../../types";

/** GET the org-wide Shipment Tracking log (Finance page's second tab). */
export async function fetchShipmentTrackingRecords(): Promise<ShipmentTrackingRecord[]> {
  const res = await api.get<{ records: ShipmentTrackingRecord[] }>("/api/workspace/shipment-tracking");
  return res.data.records ?? [];
}

export interface SaveShipmentTrackingRecordInput {
  blNumber?: string | null;
  carrierName?: string | null;
  /** "YYYY-MM-DD" */
  dispatchDate?: string | null;
  /** "YYYY-MM-DD" */
  eta?: string | null;
  pol?: string | null;
  pod?: string | null;
  containerType?: string | null;
  containerCount?: number | null;
  dispatchedFrom?: string | null;
  documentStatus?: string | null;
  remarks?: string | null;
}

/** POST a new Shipment Tracking record. */
export async function createShipmentTrackingRecord(input: SaveShipmentTrackingRecordInput): Promise<ShipmentTrackingRecord> {
  const res = await api.post<{ record: ShipmentTrackingRecord }>("/api/workspace/shipment-tracking", input);
  return res.data.record;
}

/** PUT edits an existing Shipment Tracking record. */
export async function updateShipmentTrackingRecord(
  id: number,
  input: SaveShipmentTrackingRecordInput,
): Promise<ShipmentTrackingRecord> {
  const res = await api.put<{ record: ShipmentTrackingRecord }>(`/api/workspace/shipment-tracking/${id}`, input);
  return res.data.record;
}

/** DELETE a Shipment Tracking record. */
export async function deleteShipmentTrackingRecord(id: number): Promise<void> {
  await api.delete(`/api/workspace/shipment-tracking/${id}`);
}

/** GET the "Export as PDF" option as a downloadable blob. */
export async function fetchShipmentTrackingPdf(): Promise<Blob> {
  const res = await api.get<Blob>("/api/workspace/shipment-tracking/pdf", { responseType: "blob" });
  return res.data;
}
