import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  fetchAttendanceDay,
  fetchAttendanceSummary,
  fetchMyAttendance,
  saveAttendanceDay,
  type AttendanceRecordInput,
} from "../api/attendance.api";

/** Every employee with their status for one day (admins / super admins only). */
export function useAttendanceDayQuery(date: string, enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendanceDay(wsId, date),
    queryFn: () => fetchAttendanceDay(date),
    enabled: enabled && Number.isFinite(wsId) && !!date,
  });
}

export function useAttendanceSummaryQuery(month: string, enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendanceSummary(wsId, month),
    queryFn: () => fetchAttendanceSummary(month),
    enabled: enabled && Number.isFinite(wsId) && !!month,
  });
}

export function useMyAttendanceQuery(month: string, enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendanceMine(wsId, month),
    queryFn: () => fetchMyAttendance(month),
    enabled: enabled && Number.isFinite(wsId) && !!month,
  });
}

export function useSaveAttendanceMutation() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, records }: { date: string; records: AttendanceRecordInput[] }) => saveAttendanceDay(date, records),
    // Saving changes this day, the monthly counts and anyone's own record, so refresh all attendance queries.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "attendance"] }),
  });
}
