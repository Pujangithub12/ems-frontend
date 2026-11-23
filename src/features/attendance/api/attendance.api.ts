import api from "../../../api/axios";

export type AttendanceStatus = "present" | "absent" | "on_leave" | "site_visit";

/** A person attendance is taken for — typed in on the Attendance page, not linked to the users table. */
export type AttendancePerson = { id: number; name: string; position: string | null; /** The company this person works for. */ company: string | null };

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

export type AttendanceSharing = {
  /** "owner": others use this organization's list; "member": this organization uses another's; "none": not shared. */
  role: "none" | "owner" | "member";
  /** The organization whose list is being used, when role is "member". */
  owner: { id: number; name: string } | null;
  /** The other organizations on the same list. The owner can remove any of them; a member can only leave. */
  linked: { id: number; name: string; isOwner: boolean }[];
  /** Organizations the caller administers that could be added to this list. */
  candidates: { id: number; name: string; hasOwnData: boolean }[];
};

export type ShareAttendanceResult = { organizationId: number; organizationName: string; shared: boolean; error?: string };

export async function fetchAttendanceSharing(): Promise<AttendanceSharing> {
  const res = await api.get<AttendanceSharing>("/api/attendance/sharing");
  return res.data;
}

/** Links the chosen organizations to this attendance list, so all of them see and edit the same employees and marks. */
export async function shareAttendance(targetOrganizationIds: number[]): Promise<ShareAttendanceResult[]> {
  const res = await api.post<{ results: ShareAttendanceResult[] }>("/api/attendance/sharing", { targetOrganizationIds });
  return res.data.results;
}

export async function stopSharingAttendance(organizationId: number): Promise<void> {
  await api.delete(`/api/attendance/sharing/${organizationId}`);
}

/** What the caller may do on the Attendance page: view the table, edit it, or manage who can edit. */
export type AttendancePermissions = { canView: boolean; canEdit: boolean; canManage: boolean };
export type AttendanceAccessMember = { id: number; fullName: string; email: string; role: string; canEdit: boolean };

export async function fetchAttendancePermissions(): Promise<AttendancePermissions> {
  const res = await api.get<AttendancePermissions>("/api/attendance/permissions");
  return res.data;
}

export async function fetchAttendanceAccess(): Promise<AttendanceAccessMember[]> {
  const res = await api.get<{ members: AttendanceAccessMember[] }>("/api/attendance/access");
  return res.data.members;
}

/** Full-replace of the people (besides super admins) who may edit attendance. */
export async function saveAttendanceAccess(userIds: number[]): Promise<void> {
  await api.put("/api/attendance/access", { userIds });
}

export type AttendancePersonInput = { name: string; position: string; company: string };

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
