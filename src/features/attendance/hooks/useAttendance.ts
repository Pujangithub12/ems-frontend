import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  createAttendanceEmployee,
  deleteAttendanceEmployee,
  fetchAttendanceDay,
  fetchAttendanceSummary,
  saveAttendanceDay,
  shareAttendance,
  updateAttendanceEmployee,
  type AttendancePersonInput,
  type AttendanceRecordInput,
} from "../api/attendance.api";

/** Every employee with their status for one day. */
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

/** Everything attendance shows depends on the employee list and the marks, so any change refreshes all of it. */
function useInvalidateAttendance() {
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "attendance"] });
}

export function useSaveAttendanceMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: ({ date, records }: { date: string; records: AttendanceRecordInput[] }) => saveAttendanceDay(date, records),
    onSuccess: invalidate,
  });
}

/** Copies this organization's attendance employees / marks to other organizations. The data lands in THOSE organizations, so nothing here changes. */
export function useShareAttendanceMutation() {
  return useMutation({
    mutationFn: ({ targetOrganizationIds, includeAttendance }: { targetOrganizationIds: number[]; includeAttendance: boolean }) =>
      shareAttendance(targetOrganizationIds, includeAttendance),
  });
}

export function useSaveAttendanceEmployeeMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: AttendancePersonInput }) =>
      id == null ? createAttendanceEmployee(input) : updateAttendanceEmployee(id, input),
    onSuccess: invalidate,
  });
}

export function useDeleteAttendanceEmployeeMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (id: number) => deleteAttendanceEmployee(id),
    onSuccess: invalidate,
  });
}
