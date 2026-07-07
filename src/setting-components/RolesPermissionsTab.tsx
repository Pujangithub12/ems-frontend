import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { User } from "../types";
import { ShieldCheck, AlertCircle, Loader2, Check, Settings2, X } from "lucide-react";
import {
  Eyebrow,
  getInitials,
  avatarColor,
  ROLE_STYLES,
  roleOptionsFor,
  RoleKey,
  ALL_ROLES,
  ROLE_INFO,
  PERMISSION_GROUPS,
  TOTAL_PERMISSIONS,
  hasPermission,
  permissionCountFor,
  PermissionMatrix,
} from "./SettingsShared";

type RolesPermissionsTabProps = {
  members: User[];
  membersLoading: boolean;
  membersError: string | null;
  setMembers: React.Dispatch<React.SetStateAction<User[]>>;
  setMembersError: React.Dispatch<React.SetStateAction<string | null>>;
};

const RolesPermissionsTab: React.FC<RolesPermissionsTabProps> = ({
  members,
  membersLoading,
  membersError,
  setMembers,
  setMembersError,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const [selectedRole, setSelectedRole] = useState<RoleKey>("admin");
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);

  const roleCounts: Record<RoleKey, number> = {
    super_admin: members.filter((m) => m.role === "super_admin").length,
    admin: members.filter((m) => m.role === "admin").length,
    finance: members.filter((m) => m.role === "finance").length,
    user: members.filter((m) => m.role === "user").length,
  };

  // ---------------------------------------------------------------------
  // Live permission matrix
  // ---------------------------------------------------------------------
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  const loadMatrix = async () => {
    setMatrixLoading(true);
    setMatrixError(null);
    try {
      const res = await api.get<{ permissions: PermissionMatrix }>("/api/permissions");
      setMatrix(res.data.permissions);
    } catch (err: any) {
      setMatrixError(
        err?.response?.data?.message || err.message || "Unable to load permissions.",
      );
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  const [editMode, setEditMode] = useState(false);
  const [draftMatrix, setDraftMatrix] = useState<PermissionMatrix | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEditing = () => {
    setDraftMatrix(matrix ? JSON.parse(JSON.stringify(matrix)) : {});
    setSaveError(null);
    setEditMode(true);
  };

  const cancelEditing = () => {
    setEditMode(false);
    setDraftMatrix(null);
    setSaveError(null);
  };

  const toggleDraftCell = (role: RoleKey, key: string) => {
    setDraftMatrix((prev) => {
      const base = prev || {};
      const roleRow = base[role] || {};
      return {
        ...base,
        [role]: { ...roleRow, [key]: !roleRow[key] },
      };
    });
  };

  const handleSaveMatrix = async () => {
    if (!draftMatrix) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updates: { role: string; permissionKey: string; granted: boolean }[] = [];
      for (const role of ALL_ROLES) {
        for (const group of PERMISSION_GROUPS) {
          for (const item of group.items) {
            if (!item.editable) continue;
            updates.push({
              role,
              permissionKey: item.key,
              granted: !!draftMatrix[role]?.[item.key],
            });
          }
        }
      }
      const res = await api.put<{ permissions: PermissionMatrix }>("/api/permissions", {
        updates,
      });
      setMatrix(res.data.permissions);
      setEditMode(false);
      setDraftMatrix(null);
    } catch (err: any) {
      setSaveError(
        err?.response?.data?.message || err.message || "Failed to save permissions.",
      );
    } finally {
      setSaving(false);
    }
  };

  const activeMatrix = editMode ? draftMatrix : matrix;

  const handleRoleChange = async (memberId: number, role: string) => {
    setRoleSavingId(memberId);
    setMembersError(null);
    try {
      await api.put(`/api/users/${memberId}`, { role });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
      );
    } catch (err: any) {
      setMembersError(
        err?.response?.data?.message || err.message || "Unable to update role.",
      );
    } finally {
      setRoleSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Eyebrow>Access Control</Eyebrow>
        <h3 className="font-semibold text-[22px] tracking-tight text-slate-900 mt-1">
          Roles & Permissions
        </h3>
        <p className="text-slate-500 text-[13px] mt-1.5 max-w-2xl leading-relaxed">
          Every workspace member is assigned one of four built-in roles that
          controls which features they can access and which actions they can
          perform. Only a super administrator can edit these permissions.
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ALL_ROLES.map((role) => {
          const info = ROLE_INFO[role];
          const isSelected = selectedRole === role;
          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`text-left p-4 bg-white border rounded-md transition-colors ${
                isSelected ? "border-2" : "border-slate-200 hover:border-slate-300"
              }`}
              style={isSelected ? { borderColor: info.color } : undefined}
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg text-[11px] font-bold mb-3"
                style={{ background: `${info.color}1A`, color: info.color }}
              >
                {info.initials}
              </div>
              <div className="font-semibold text-[14px] text-slate-900">
                {info.label}
              </div>
              <div className="flex items-center gap-4 mt-2.5">
                <div>
                  <div className="text-[18px] font-bold" style={{ color: info.color }}>
                    {roleCounts[role]}
                  </div>
                  <div className="text-[11px] text-slate-400">members</div>
                </div>
                <div>
                  <div className="text-[18px] font-bold text-slate-900">
                    {permissionCountFor(matrix, role)}
                  </div>
                  <div className="text-[11px] text-slate-400">permissions</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected role detail */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <div
            className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg text-[12px] font-bold"
            style={{ background: `${ROLE_INFO[selectedRole].color}1A`, color: ROLE_INFO[selectedRole].color }}
          >
            {ROLE_INFO[selectedRole].initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-slate-900">
                {ROLE_INFO[selectedRole].label}
              </span>
              {ROLE_INFO[selectedRole].badge && (
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{ background: `${ROLE_INFO[selectedRole].color}1A`, color: ROLE_INFO[selectedRole].color }}
                >
                  {ROLE_INFO[selectedRole].badge}
                </span>
              )}
            </div>
            <p className="text-slate-500 text-[12.5px] mt-0.5">
              {ROLE_INFO[selectedRole].description}
            </p>
          </div>
        </div>

        <div className="flex items-center px-5 pt-4">
          <Eyebrow>
            Permissions ({permissionCountFor(matrix, selectedRole)} of {TOTAL_PERMISSIONS})
          </Eyebrow>
        </div>
        <div className="px-5 pb-5">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.category} className="pt-3">
              <div className="text-[10px] tracking-[0.08em] uppercase text-slate-400 font-semibold pb-1.5">
                {group.category}
              </div>
              {group.items.map((item) => {
                const has = hasPermission(matrix, selectedRole, item);
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 py-1.5 border-t border-slate-100 first:border-t-0"
                  >
                    {has ? (
                      <span className="flex items-center justify-center flex-shrink-0 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center flex-shrink-0 w-4 h-4 text-slate-300">
                        –
                      </span>
                    )}
                    <span className={`text-[13px] ${has ? "text-slate-700" : "text-slate-400"}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Full permission matrix */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <div className="font-semibold text-[15px] text-slate-900">
              Full Permission Matrix
            </div>
            <p className="text-slate-500 text-[12.5px] mt-0.5">
              All permissions across all roles at a glance
            </p>
          </div>
          {isSuperAdmin && !editMode && (
            <button
              onClick={startEditing}
              disabled={matrixLoading || !matrix}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              <Settings2 className="w-3.5 h-3.5" /> Manage Permissions
            </button>
          )}
          {isSuperAdmin && editMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={handleSaveMatrix}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-70"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          )}
        </div>

        {matrixError && (
          <div className="m-5 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100 flex items-center gap-2">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {matrixError}
          </div>
        )}
        {saveError && (
          <div className="mx-5 mt-3 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100 flex items-center gap-2">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {saveError}
          </div>
        )}
        {editMode && (
          <div className="mx-5 mt-3 p-3 text-[12px] font-medium border text-blue-900 bg-blue-50 rounded border-blue-100">
            Editing mode: click a permission's cell to toggle it for that role. Rows
            without a toggle have no backend gate to enforce (they're open to
            everyone) and aren't configurable.
          </div>
        )}

        {matrixLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#EEF1F5]/30 border-b border-slate-200">
                  <th className="px-5 py-2.5 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
                    Permission
                  </th>
                  {ALL_ROLES.map((role) => (
                    <th key={role} className="px-4 py-2.5 text-center">
                      <div
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[10px] font-bold mb-1"
                        style={{ background: `${ROLE_INFO[role].color}1A`, color: ROLE_INFO[role].color }}
                      >
                        {ROLE_INFO[role].initials}
                      </div>
                      <div className="text-[9px] font-medium tracking-wide text-slate-400 uppercase">
                        {ROLE_INFO[role].label.split(" ")[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <React.Fragment key={group.category}>
                    <tr className="bg-[#EEF1F5]/50">
                      <td
                        colSpan={ALL_ROLES.length + 1}
                        className="px-5 py-1.5 text-[10px] tracking-[0.08em] uppercase text-slate-400 font-semibold"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={item.label} className="border-b border-slate-100">
                        <td className="px-5 py-2.5 text-[13px] text-slate-700">
                          {item.label}
                        </td>
                        {ALL_ROLES.map((role) => {
                          const granted = hasPermission(activeMatrix, role, item);
                          const interactive = editMode && item.editable;
                          return (
                            <td key={role} className="px-4 py-2.5 text-center">
                              {interactive ? (
                                <button
                                  type="button"
                                  onClick={() => toggleDraftCell(role, item.key)}
                                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors ${
                                    granted
                                      ? "bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200"
                                      : "border-slate-200 text-transparent hover:border-slate-300 hover:bg-slate-50"
                                  }`}
                                  title={`Toggle "${item.label}" for ${ROLE_INFO[role].label}`}
                                >
                                  <Check className="w-3 h-3" strokeWidth={3} />
                                </button>
                              ) : granted ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3 h-3" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="text-slate-300">–</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign roles to members */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <ShieldCheck className="w-4 h-4 text-slate-400" />
          <div className="font-semibold text-[15px] text-slate-900">
            Assign roles to members
          </div>
        </div>

        {membersError && (
          <div className="m-5 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100 flex items-center gap-2">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {membersError}
          </div>
        )}

        {membersLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          </div>
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
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const canEdit = isAdmin && m.id !== Number(user?.id);
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
                        {canEdit ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              disabled={roleSavingId === m.id}
                              className="px-2.5 py-1.5 text-[12px] font-medium bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-900 transition-colors"
                            >
                              {roleOptionsFor(user?.role).map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {roleSavingId === m.id && (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                            )}
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] tracking-[0.05em] uppercase font-semibold"
                            style={{
                              background: (ROLE_STYLES[m.role] || { bg: "#EEF1F5" }).bg,
                              color: (ROLE_STYLES[m.role] || { fg: "#475569" }).fg,
                            }}
                          >
                            {m.role}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RolesPermissionsTab;
