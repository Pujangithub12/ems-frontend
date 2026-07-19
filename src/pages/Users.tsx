import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import {
  Search,
  Edit2,
  Trash2,
  Mail,
  Phone,
} from "lucide-react";
import OrgTree from "../components/orgtree/OrgTree";
import { User } from "../types";
import UserFormModal from "../components/UserFormModal";
import ConfirmationModal from "../components/ConfirmationModal";
import LoadingState from "../components/LoadingState";
import ErrorBanner from "../components/ErrorBanner";
import { getErrorMessage } from "../lib/errors";
import { useUsers, useInviteUser, useUpdateUser, useDeleteUser } from "../hooks/useUsers";
import { useHierarchy, useSaveHierarchy } from "../hooks/useHierarchy";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Capitalizes the first letter of each word, leaving the rest untouched. */
const capitalizeWords = (value: string) =>
  value
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  const [userForm, setUserForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    address: "",
    jobPosition: "",
    joinDate: "",
    role: "user",
  });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [inviteSentMessage, setInviteSentMessage] = useState<string | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    userId: number | null;
  }>({ isOpen: false, userId: null });

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersIsError,
    error: usersQueryError,
  } = useUsers();
  const {
    data: people = [],
    isLoading: treeLoading,
  } = useHierarchy();
  const inviteUserMutation = useInviteUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const saveHierarchyMutation = useSaveHierarchy();

  const usersError = usersIsError
    ? getErrorMessage(usersQueryError, "Unable to load users.")
    : null;
  const userFormSubmitting = inviteUserMutation.isPending || updateUserMutation.isPending;

  const location = useLocation();
  const navigate = useNavigate();

  // Opened via the "Invite Members" action in the profile menu.
  useEffect(() => {
    if ((location.state as { openInvite?: boolean } | null)?.openInvite) {
      setShowUserForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const resetUserForm = () => {
    setUserForm({
      fullName: "",
      email: "",
      password: "",
      phoneNumber: "",
      address: "",
      jobPosition: "",
      joinDate: "",
      role: "user",
    });
    setEditingUser(null);
    setUserFormError(null);
  };

  const handleUserFieldChange = (
    field: keyof typeof userForm,
    value: string,
  ) => {
    setUserForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setShowUserForm(true);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      phoneNumber: user.phoneNumber,
      address: user.address,
      jobPosition: user.jobPosition,
      joinDate: user.joinDate.slice(0, 10),
      role: user.role,
    });
  };

  const handleSubmitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserFormError(null);

    const payload: Record<string, unknown> = {
      fullName: userForm.fullName,
      email: userForm.email,
      password: userForm.password,
      phoneNumber: userForm.phoneNumber,
      address: userForm.address,
      jobPosition: userForm.jobPosition,
      joinDate: userForm.joinDate,
      role: userForm.role,
    };

    try {
      if (editingUser) {
        if (!payload.password) delete payload.password;
        await updateUserMutation.mutateAsync({ id: editingUser.id, payload });
      } else {
        delete payload.password;
        const result = await inviteUserMutation.mutateAsync(payload as any);
        setInviteSentMessage(
          result?.message === "Existing user added to workspace"
            ? `${userForm.email} already had an account — added them to this workspace.`
            : `Invitation sent to ${userForm.email}.`,
        );
      }
      setShowUserForm(false);
      resetUserForm();
    } catch (err) {
      setUserFormError(getErrorMessage(err, "Unable to save user."));
    }
  };

  const handleDeleteUser = (id: number) => {
    setConfirmModal({ isOpen: true, userId: id });
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteUser = async () => {
    if (!confirmModal.userId) return;
    try {
      await deleteUserMutation.mutateAsync(confirmModal.userId);
      setConfirmModal({ isOpen: false, userId: null });
    } catch (err) {
      setDeleteError(getErrorMessage(err, "Unable to delete user."));
      setConfirmModal({ isOpen: false, userId: null });
    }
  };

  const filteredUsers = users
    .filter(
      (user) =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.jobPosition.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const isAdminOrSuperAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  // Admins can remove regular users/finance, but not peers or super admins —
  // only a super admin can remove another admin (or a user).
  const canDeleteUser = (target: User) => {
    if (currentUser?.role === "super_admin") return true;
    if (currentUser?.role === "admin") {
      return target.role !== "admin" && target.role !== "super_admin";
    }
    return false;
  };

  const roleStyles: Record<string, { bg: string; fg: string }> = {
    admin: { bg: "#EDE9FE", fg: "#6D28D9" },
    super_admin: { bg: "#FEE2E2", fg: "#B91C1C" },
    finance: { bg: "#FEF3C7", fg: "#B45309" },
    user: { bg: "#DBEAFE", fg: "#1E3A8A" },
  };

  // Cycled, deterministic (by id) avatar colors so the list reads with the
  // same varied-but-consistent look row to row instead of one flat color.
  const AVATAR_COLORS = [
    "#4338CA", // indigo
    "#047857", // emerald
    "#BE123C", // rose
    "#7C3AED", // violet
    "#1D4ED8", // blue
    "#475569", // slate
    "#B45309", // amber
  ];
  const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

  return (
    <div className="w-full px-6 py-6 lg:px-8 lg:py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 mb-6 md:flex-row md:items-center">

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-[#EEF1F5] rounded p-0.5 border border-slate-200">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1 rounded text-[12px] font-medium transition-colors ${viewMode === "tree" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Tree
            </button>
          </div>
        </div>
      </div>

      {inviteSentMessage && (
        <ErrorBanner
          variant="success"
          message={inviteSentMessage}
          onDismiss={() => setInviteSentMessage(null)}
          className="mb-4"
        />
      )}

      {deleteError && (
        <ErrorBanner
          message={deleteError}
          onDismiss={() => setDeleteError(null)}
          className="mb-4"
        />
      )}

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or position..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
        />
      </div>

      {/* User Form Modal */}
      <UserFormModal
        isOpen={showUserForm}
        editingUser={editingUser}
        userForm={userForm}
        userFormError={userFormError}
        userFormSubmitting={userFormSubmitting}
        currentUserRole={currentUser?.role}
        onClose={() => {
          setShowUserForm(false);
          resetUserForm();
        }}
        onSubmit={handleSubmitUser}
        onFieldChange={handleUserFieldChange}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, userId: null })}
        onConfirm={confirmDeleteUser}
        message="Are you sure you want to delete this user?"
      />

      {/* Content based on View Mode */}
      {viewMode === "list" ? (
        <div className="overflow-hidden bg-white border rounded-md border-slate-200">
          {usersLoading ? (
            <LoadingState label="Loading users" />
          ) : usersError ? (
            <ErrorBanner message={usersError} className="m-6" />
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                <Search className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                No users found
              </h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                We couldn't find any users matching your search criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Position
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-slate-400 uppercase">
                      Role
                    </th>
                    {isAdminOrSuperAdmin && (
                      <th className="px-6 py-3 text-[11px] font-medium tracking-wide text-right text-slate-400 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((userItem) => {
                    const rStyle = roleStyles[userItem.role] || {
                      bg: "#EEF1F5",
                      fg: "#475569",
                    };
                    return (
                      <tr
                        key={userItem.id}
                        className="transition-colors border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full"
                              style={{ background: avatarColor(userItem.id) }}
                            >
                              {getInitials(userItem.fullName)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-[13.5px] text-slate-900 truncate">
                                {capitalizeWords(userItem.fullName)}
                              </div>
                              <div className="text-slate-400 text-[12px] truncate">
                                {userItem.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-[13px]">
                          {capitalizeWords(userItem.jobPosition)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-500 text-[12.5px]">
                              <Mail className="w-3 h-3 text-slate-400" />
                              {userItem.email}
                            </div>
                            <div className="flex items-center gap-2 text-slate-500 text-[12.5px]">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {userItem.phoneNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-[0.05em] uppercase font-semibold"
                            style={{
                              background: rStyle.bg,
                              color: rStyle.fg,
                            }}
                          >
                            {userItem.role}
                          </span>
                        </td>
                        {isAdminOrSuperAdmin && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleStartEditUser(userItem)}
                                className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-blue-50 rounded transition-colors"
                                title="Edit User"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {canDeleteUser(userItem) && (
                                <button
                                  onClick={() => handleDeleteUser(userItem.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
      ) : treeLoading ? (
        <div className="bg-white border rounded-md border-slate-200">
          <LoadingState label="Loading hierarchy" />
        </div>
      ) : (
        <OrgTree people={people} onSave={(updated) => saveHierarchyMutation.mutate(updated)} />
      )}
    </div>
  );
};

export default Users;
