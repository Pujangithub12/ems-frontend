import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import {
  createAttendanceEmployee,
  deleteAttendanceEmployee,
  fetchAttendanceAccess,
  fetchAttendanceDay,
  fetchAttendancePermissions,
  fetchAttendanceSharing,
  fetchAttendanceSummary,
  saveAttendanceAccess,
  saveAttendanceDay,
  shareAttendance,
  stopSharingAttendance,
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

export function useAttendancePermissionsQuery() {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendancePermissions(wsId),
    queryFn: fetchAttendancePermissions,
    enabled: Number.isFinite(wsId),
  });
}

export function useAttendanceAccessQuery(enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendanceAccess(wsId),
    queryFn: fetchAttendanceAccess,
    enabled: enabled && Number.isFinite(wsId),
  });
}

export function useSaveAttendanceAccessMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({ mutationFn: (userIds: number[]) => saveAttendanceAccess(userIds), onSuccess: invalidate });
}

export function useAttendanceSharingQuery(enabled = true) {
  const wsId = useOrganizationId();
  return useQuery({
    queryKey: queryKeys.attendanceSharing(wsId),
    queryFn: fetchAttendanceSharing,
    enabled: enabled && Number.isFinite(wsId),
  });
}

/** Linking or unlinking organizations changes which list every attendance query reads, so refresh all of them. */
export function useShareAttendanceMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (targetOrganizationIds: number[]) => shareAttendance(targetOrganizationIds),
    onSuccess: invalidate,
  });
}

export function useStopSharingAttendanceMutation() {
  const invalidate = useInvalidateAttendance();
  return useMutation({
    mutationFn: (organizationId: number) => stopSharingAttendance(organizationId),
    onSuccess: invalidate,
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
