import React, { useState } from "react";
import { Plus, X, Loader2, Search, AlertCircle, Trash2 } from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { Project } from "../types";
import { Eyebrow } from "./ProjectSharedComponents";
import ConfirmationModal from "../components/ConfirmationModal";

const ROLE_STYLES: Record<string, { bg: string; fg: string }> = {
  super_admin: { bg: "#FEE2E2", fg: "#B91C1C" },
  admin: { bg: "#EDE9FE", fg: "#6D28D9" },
  finance: { bg: "#FEF3C7", fg: "#B45309" },
  user: { bg: "#DBEAFE", fg: "#1E3A8A" },
};

interface ProjectTeamTabProps {
  project: Project;
  onTeamUpdate?: () => void;
}

type WorkspaceUser = { id: number; fullName: string; email: string };

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

const ProjectTeamTab: React.FC<ProjectTeamTabProps> = ({
  project,
  onTeamUpdate,
}) => {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "super_admin";

  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState<WorkspaceUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<number | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const assignedIds = new Set((project.assignees || []).map((a) => a.id));

  const handleRemoveClick = (memberId: number) => {
    setMemberToRemove(memberId);
    setShowRemoveModal(true);
    setRemoveError(null);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const nextIds = Array.from(assignedIds).filter(
        (id) => id !== memberToRemove,
      );
      await api.put(`/api/projects/${project.id}`, { assigneeIds: nextIds });
      setShowRemoveModal(false);
      setMemberToRemove(null);
      onTeamUpdate?.();
    } catch (err: any) {
      setRemoveError(
        err?.response?.data?.message || err.message || "Unable to remove member.",
      );
    } finally {
      setRemoving(false);
    }
  };

  const openAddModal = async () => {
    setShowAddModal(true);
    setSelectedIds([]);
    setSearchTerm("");
    setSaveError(null);
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await api.get<WorkspaceUser[]>("/api/users");
      setAllUsers(
        [...res.data].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch (err: any) {
      setUsersError(
        err?.response?.data?.message || err.message || "Unable to load members.",
      );
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleAddMembers = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const nextIds = Array.from(new Set([...assignedIds, ...selectedIds]));
      await api.put(`/api/projects/${project.id}`, { assigneeIds: nextIds });
      setShowAddModal(false);
      onTeamUpdate?.();
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.message || err.message || "Unable to add members.",
      );
    } finally {
      setSaving(false);
    }
  };

  const availableUsers = allUsers
    .filter((u) => !assignedIds.has(u.id))
    .filter((u) => u.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Assigned Members</Eyebrow>
        {canManage && (
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Member
          </button>
        )}
      </div>

      {removeError && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-red-50 border border-red-100 rounded text-red-700 text-[12px]">
          <AlertCircle className="flex-shrink-0 w-3.5 h-3.5" />
          {removeError}
        </div>
      )}

      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        {project.assignees && project.assignees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#EEF1F5]/30 border-b border-slate-200">
                  <th className="px-5 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Email
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Role
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Position
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Contact
                  </th>
                  {canManage && (
                    <th className="px-4 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase text-right">
                      &nbsp;
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {project.assignees.map((member) => {
                  const roleStyle =
                    ROLE_STYLES[member.role || "user"] || ROLE_STYLES.user;
                  return (
                    <tr
                      key={member.id}
                      className="transition-colors border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full bg-blue-900">
                            {initials(member.fullName)}
                          </div>
                          <span className="font-medium text-[13px] text-slate-900 truncate">
                            {member.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-600 truncate">
                        {member.email || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.05em] uppercase font-semibold"
                          style={{ background: roleStyle.bg, color: roleStyle.fg }}
                        >
                          {(member.role || "user").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-600">
                        {member.jobPosition || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-slate-600 whitespace-nowrap">
                        {member.phoneNumber || "—"}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveClick(member.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remove from project"
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
        ) : (
          <p className="p-6 text-center text-slate-500 text-[12px] italic">
            No members assigned to this project.
          </p>
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-md bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0 px-5 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>Team</Eyebrow>
                <h3 className="font-semibold text-[16px] text-slate-900 mt-0.5">
                  Add Members to Project
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-shrink-0 px-5 pt-4">
              <div className="relative">
                <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search workspace members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full py-2 pr-3 text-[13px] bg-white border border-slate-200 rounded pl-9 outline-none focus:border-blue-900 transition-colors"
                />
              </div>
              {saveError && (
                <div className="flex items-center gap-2 mt-3 p-2.5 bg-red-50 border border-red-100 rounded text-red-700 text-[12px]">
                  <AlertCircle className="flex-shrink-0 w-3.5 h-3.5" />
                  {saveError}
                </div>
              )}
            </div>

            <div className="flex-1 px-5 py-3 overflow-y-auto space-y-1">
              {usersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
                </div>
              ) : usersError ? (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded text-red-700 text-[12px]">
                  <AlertCircle className="flex-shrink-0 w-3.5 h-3.5" />
                  {usersError}
                </div>
              ) : availableUsers.length === 0 ? (
                <p className="py-6 text-center text-slate-400 text-[12px]">
                  {allUsers.length === 0
                    ? "No workspace members found."
                    : "Everyone in the workspace is already on this project."}
                </p>
              ) : (
                availableUsers.map((u) => {
                  const checked = selectedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleSelected(u.id)}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${
                        checked ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                        {initials(u.fullName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">
                          {u.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {u.email}
                        </p>
                      </div>
                      <div
                        className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 ${
                          checked
                            ? "bg-blue-900 border-blue-900"
                            : "border-slate-300"
                        }`}
                      >
                        {checked && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="white"
                            strokeWidth={3}
                            className="w-2.5 h-2.5"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end flex-shrink-0 gap-2 px-5 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 text-[13px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={selectedIds.length === 0 || saving}
                className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Add {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirmation */}
      <ConfirmationModal
        isOpen={showRemoveModal}
        onClose={() => {
          setShowRemoveModal(false);
          setMemberToRemove(null);
        }}
        onConfirm={confirmRemoveMember}
        isLoading={removing}
        title="Remove Member"
        message="Are you sure you want to remove this member from the project?"
        confirmText="Remove"
      />
    </div>
  );
};

export default ProjectTeamTab;
