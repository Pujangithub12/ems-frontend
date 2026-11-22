import api from "../../../api/axios";

export type AttendanceStatus = "present" | "absent" | "on_leave";

/** A person attendance is taken for — typed in on the Attendance page, not linked to the users table. */
export type AttendancePerson = { id: number; name: string; position: string | null };

export type AttendanceEmployee = AttendancePerson & {
  /** null = attendance not taken for this person on that day yet. */
  status: AttendanceStatus | null;
  note: string;
};

export type AttendanceDay = { date: string; employees: AttendanceEmployee[] };

export type AttendanceCounts = Record<AttendanceStatus, number>;

export type AttendanceDayMark = { date: string; status: AttendanceStatus; note: string };
export type AttendanceSummaryRow = AttendancePerson &
  AttendanceCounts & {
    marked: number;
    /** Every day this employee was marked in the month, oldest first. */
    days: AttendanceDayMark[];
  };
export type AttendanceSummary = { month: string; employees: AttendanceSummaryRow[] };

export type AttendanceRecordInput = { employeeId: number; status: AttendanceStatus | ""; note: string };

export async function fetchAttendanceDay(date: string): Promise<AttendanceDay> {
  const res = await api.get<AttendanceDay>("/api/attendance", { params: { date } });
  return res.data;
}

export async function saveAttendanceDay(date: string, records: AttendanceRecordInput[]): Promise<void> {
  await api.put("/api/attendance", { date, records });
}

export async function fetchAttendanceSummary(month: string): Promise<AttendanceSummary> {
  const res = await api.get<AttendanceSummary>("/api/attendance/summary", { params: { month } });
  return res.data;
}

export type ShareAttendanceResult = {
  organizationId: number;
  organizationName: string;
  employeesAdded: number;
  employeesMatched: number;
  marksCopied: number;
  error?: string;
};

/** Copies the employee list (and optionally all attendance marks) into other organizations the caller administers. */
export async function shareAttendance(targetOrganizationIds: number[], includeAttendance: boolean): Promise<ShareAttendanceResult[]> {
  const res = await api.post<{ results: ShareAttendanceResult[] }>("/api/attendance/share", { targetOrganizationIds, includeAttendance });
  return res.data.results;
}

export type AttendancePersonInput = { name: string; position: string };

export async function createAttendanceEmployee(input: AttendancePersonInput): Promise<AttendancePerson> {
  const res = await api.post<{ employee: AttendancePerson }>("/api/attendance/employees", input);
  return res.data.employee;
}

export async function updateAttendanceEmployee(id: number, input: AttendancePersonInput): Promise<AttendancePerson> {
  const res = await api.put<{ employee: AttendancePerson }>(`/api/attendance/employees/${id}`, input);
  return res.data.employee;
}

export async function deleteAttendanceEmployee(id: number): Promise<void> {
  await api.delete(`/api/attendance/employees/${id}`);
}
