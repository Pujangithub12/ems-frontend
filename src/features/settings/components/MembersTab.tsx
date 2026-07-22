import React, { useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import { User } from "../../../types";
import ConfirmationModal from "../../../components/ConfirmationModal";
import UserFormModal from "../../../components/UserFormModal";
import LoadingState from "../../../components/LoadingState";
import ErrorBanner from "../../../components/ErrorBanner";
import { getErrorMessage } from "../../../lib/errors";
import { useUsers, useInviteUser, useDeleteUser } from "../../users/hooks/useUsers";
import { UserPlus, Trash2 } from "lucide-react";
import { getInitials, avatarColor, ROLE_STYLES } from "./SettingsShared";

const emptyMemberForm = {
  fullName: "",
  email: "",
  password: "",
  phoneNumber: "",
  address: "",
  jobPosition: "",
  joinDate: "",
  role: "user",
};

const MembersTab: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersIsError,
    error: membersQueryError,
  } = useUsers();
  const sortedMembers = [...members].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const membersError = membersIsError
    ? getErrorMessage(membersQueryError, "Unable to load members.")
    : null;

  const inviteUserMutation = useInviteUser();
  const deleteUserMutation = useDeleteUser();

  const [showAddMember, setShowAddMember] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [memberFormError, setMemberFormError] = useState<string | null>(null);
  const [inviteSentMessage, setInviteSentMessage] = useState<string | null>(null);

  const handleMemberFieldChange = (field: string, value: string) => {
    setMemberForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormError(null);
    const { password, ...payload } = memberForm;
    try {
      await inviteUserMutation.mutateAsync(payload);
      setInviteSentMessage(`Invitation sent to ${memberForm.email}.`);
      setShowAddMember(false);
      setMemberForm(emptyMemberForm);
    } catch (err) {
      setMemberFormError(getErrorMessage(err, "Unable to invite member."));
    }
  };

  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);
  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await deleteUserMutation.mutateAsync(removeTarget.id);
      setRemoveTarget(null);
    } catch (err) {
      setRemoveError(getErrorMessage(err, "Unable to remove member."));
      setRemoveTarget(null);
    }
  };

  return (
    <>
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center px-5 py-4 border-b border-slate-200">
          <div className="font-semibold text-[15px] text-slate-900">
            Workspace members
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 px-3 py-1.5 ml-auto text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Invite Member
            </button>
          )}
        </div>

        {inviteSentMessage && (
          <ErrorBanner
            variant="success"
            message={inviteSentMessage}
            onDismiss={() => setInviteSentMessage(null)}
            className="m-5"
          />
        )}
        {removeError && (
          <ErrorBanner
            message={removeError}
            onDismiss={() => setRemoveError(null)}
            className="m-5"
          />
        )}
        {membersError && <ErrorBanner message={membersError} className="m-5" />}

        {membersLoading ? (
          <LoadingState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-2.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    Member
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                    Role
                  </th>
                  {isAdmin && (
                    <th className="px-5 py-2.5 text-[11px] font-medium tracking-wide text-right text-slate-400 uppercase">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m) => {
                  const rStyle = ROLE_STYLES[m.role] || { bg: "#EEF1F5", fg: "#475569" };
                  return (
                    <tr key={m.id} className="transition-colors border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full"
                            style={{ background: avatarColor(m.id) }}
                          >
                            {getInitials(m.fullName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[13.5px] text-slate-900 truncate">
                              {m.fullName}
                            </div>
                            <div className="text-slate-400 text-[12px] truncate">
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-[0.05em] uppercase font-semibold"
                          style={{ background: rStyle.bg, color: rStyle.fg }}
                        >
                          {m.role}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setRemoveTarget(m)}
                            disabled={m.id === Number(user?.id)}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={m.id === Number(user?.id) ? "You can't remove yourself" : "Remove from workspace"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      <UserFormModal
        isOpen={showAddMember}
        editingUser={null}
        userForm={memberForm}
        userFormError={memberFormError}
        userFormSubmitting={inviteUserMutation.isPending}
        currentUserRole={user?.role}
        onClose={() => {
          setShowAddMember(false);
          setMemberForm(emptyMemberForm);
          setMemberFormError(null);
        }}
        onSubmit={handleAddMember}
        onFieldChange={handleMemberFieldChange}
      />

      {/* Remove Member Confirmation */}
      <ConfirmationModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
        title="Remove Member"
        message={`Remove ${removeTarget?.fullName} from this workspace? Their account is not deleted.`}
        confirmText="Remove"
      />
    </>
  );
};

export default MembersTab;
