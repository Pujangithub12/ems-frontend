import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthProvider";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { queryKeys } from "../../../lib/queryKeys";
import { canApprove as hierarchyCanApprove } from "../../../lib/hierarchyAuthority";
import { useHierarchy } from "../../hierarchy/hooks/useHierarchy";
import { useUpdateLeaveRequestStatus } from "../../approvals/hooks/useLeaveRequests";

/**
 * Who may approve / reject a leave request, and the call that does it. Approving needs the admin / super admin role
 * AND being that requester's admin in the org chart (a super admin can approve anyone) — the same rule the
 * Approvals page used before leave requests moved to the Attendance page. Approving also marks the person "On Leave"
 * for the leave dates (done by the backend).
 */
export function useLeaveActions() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const currentUserId = user?.id ? Number(user.id) : null;
  const canManage = role === "admin" || role === "super_admin";
  const { data: hierarchyPeople = [] } = useHierarchy();
  const updateStatus = useUpdateLeaveRequestStatus();
  const wsId = useOrganizationId();
  const queryClient = useQueryClient();

  const canActOn = (requesterUserId: number | undefined) => {
    if (!canManage || !currentUserId || requesterUserId == null) return false;
    if (role === "super_admin") return true;
    return hierarchyCanApprove(hierarchyPeople, currentUserId, role, requesterUserId);
  };

  return {
    canManage,
    canActOn,
    // Approving leave marks the person "On Leave" on the server, so reload the attendance data afterwards.
    setStatus: async (id: number, status: "approved" | "rejected") => {
      await updateStatus.mutateAsync({ id, status });
      await queryClient.invalidateQueries({ queryKey: [...queryKeys.all(wsId), "attendance"] });
    },
    isPending: updateStatus.isPending,
  };
}
