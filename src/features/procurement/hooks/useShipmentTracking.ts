import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchShipmentTrackingRecords,
  createShipmentTrackingRecord,
  updateShipmentTrackingRecord,
  deleteShipmentTrackingRecord,
  SaveShipmentTrackingRecordInput,
} from "../api/shipmentTracking.api";

export function useShipmentTrackingRecordsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.shipmentTrackingRecords(wsId),
    queryFn: () => fetchShipmentTrackingRecords(),
    enabled: Number.isFinite(wsId),
  });
}

export function useCreateShipmentTrackingRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveShipmentTrackingRecordInput) => createShipmentTrackingRecord(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentTrackingRecords(wsId) });
    },
  });
}

export function useUpdateShipmentTrackingRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SaveShipmentTrackingRecordInput }) =>
      updateShipmentTrackingRecord(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentTrackingRecords(wsId) });
    },
  });
}

export function useDeleteShipmentTrackingRecordMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteShipmentTrackingRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shipmentTrackingRecords(wsId) });
    },
  });
}
