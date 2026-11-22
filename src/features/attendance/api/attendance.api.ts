import api from "../../../api/axios";

export type AttendanceStatus = "present" | "absent" | "on_leave";

export type AttendanceEmployee = {
  id: number;
  fullName: string;
  email: string;
  jobPosition: string | null;
  role: string;
  /** null = attendance not taken for this person on that day yet. */
  status: AttendanceStatus | null;
  note: string;
};

export type AttendanceDay = { date: string; employees: AttendanceEmployee[] };

export type AttendanceCounts = Record<AttendanceStatus, number>;

export type AttendanceDayMark = { date: string; status: AttendanceStatus; note: string };
export type AttendanceSummaryRow = Omit<AttendanceEmployee, "status" | "note"> & AttendanceCounts & {
  marked: number;
  /** Every day this employee was marked in the month, oldest first. */
  days: AttendanceDayMark[];
};
export type AttendanceSummary = { month: string; employees: AttendanceSummaryRow[] };

export type MyAttendance = {
  month: string;
  counts: AttendanceCounts;
  records: { date: string; status: AttendanceStatus; note: string }[];
};

export type AttendanceRecordInput = { userId: number; status: AttendanceStatus | ""; note: string };

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

export async function fetchMyAttendance(month: string): Promise<MyAttendance> {
  const res = await api.get<MyAttendance>("/api/attendance/me", { params: { month } });
  return res.data;
}
