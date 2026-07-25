import React, { useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthProvider";
import {
  ShieldCheck,
  AlertCircle,
  Loader2,
  Check,
  Settings2,
  X,
  Search,
  LayoutDashboard,
  Briefcase,
  CheckSquare,
  Megaphone,
  Users,
  CalendarClock,
  MapPin,
  Wallet,
  CalendarDays,
  Settings as SettingsIcon,
  Network,
  Lock,
} from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import { useUsers, useUpdateUser } from "../../users/hooks/useUsers";
import { usePermissions, useUpdatePermissions } from "../hooks/usePermissions";
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

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Overview: LayoutDashboard,
  Projects: Briefcase,
  Tasks: CheckSquare,
  Announcements: Megaphone,
  Members: Users,
  "Leave Requests": CalendarClock,
  "Site Visit Requests": MapPin,
  "Expense Requests": Wallet,
  Calendar: CalendarDays,
  Workspace: SettingsIcon,
  "Org Hierarchy": Network,
};

/** Presentational on/off switch — the enclosing button owns the click. */
const ToggleSwitch: React.FC<{ checked: boolean; disabled?: boolean }> = ({ checked, disabled }) => (
  <span
    role="switch"
    aria-checked={checked}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
      disabled ? "opacity-50" : ""
    } ${checked ? "bg-blue-900" : "bg-slate-200"}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        checked ? "translate-x-[18px]" : "translate-x-1"
      }`}
    />
  </span>
);

const RolesPermissionsTab: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersIsError,
    error: membersQueryError,
  } = useUsers();
  const membersError = membersIsError
    ? getErrorMessage(membersQueryError, "Unable to load members.")
    : null;
  const updateUserMutation = useUpdateUser();

  const [selectedRole, setSelectedRole] = useState<RoleKey>("admin");
  const [roleSavingId, setRoleSavingId] = useState<number | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");

  const roleCounts: Record<RoleKey, number> = {
    super_admin: members.filter((m) => m.role === "super_admin").length,
    admin: members.filter((m) => m.role === "admin").length,
    finance: members.filter((m) => m.role === "finance").length,
    user: members.filter((m) => m.role === "user").length,
  };

  // ---------------------------------------------------------------------
  // Live permission matrix
  // ---------------------------------------------------------------------
  const {
    data: rawMatrix,
    isLoading: matrixLoading,
    isError: matrixIsError,
    error: matrixQueryError,
  } = usePermissions();
  const matrix = rawMatrix ?? null;
  const matrixError = matrixIsError
    ? getErrorMessage(matrixQueryError, "Unable to load permissions.")
    : null;
  const updatePermissionsMutation = useUpdatePermissions();

  const [editMode, setEditMode] = useState(false);
  const [draftMatrix, setDraftMatrix] = useState<PermissionMatrix | null>(null);
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
      await updatePermissionsMutation.mutateAsync(updates);
      setEditMode(false);
      setDraftMatrix(null);
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save permissions."));
    }
  };

  const activeMatrix = editMode ? draftMatrix : matrix;
  const saving = updatePermissionsMutation.isPending;

  const handleRoleChange = async (memberId: number, role: string) => {
    setRoleSavingId(memberId);
    setRoleChangeError(null);
    try {
      await updateUserMutation.mutateAsync({ id: memberId, payload: { role } });
    } catch (err) {
      setRoleChangeError(getErrorMessage(err, "Unable to update role."));
    } finally {
      setRoleSavingId(null);
    }
  };

  const visibleGroups = useMemo(() => {
    const q = permissionSearch.trim().toLowerCase();
    if (!q) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.label.toLowerCase().includes(q) || group.category.toLowerCase().includes(q),
      ),
    })).filter((group) => group.items.length > 0);
  }, [permissionSearch]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  const selectedInfo = ROLE_INFO[selectedRole];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Eyebrow>Access Control</Eyebrow>
        <h3 className="font-semibold text-[22px] tracking-tight text-slate-900 mt-1">
          Roles & Permissions
        </h3>
        <p className="text-slate-500 text-[13px] mt-1.5 max-w-2xl leading-relaxed">
          Pick a role below to see exactly what it can do, and switch on or off
          individual permissions for it. Only a super administrator can make changes.
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
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-[11px] font-bold"
                  style={{ background: `${info.color}1A`, color: info.color }}
                >
                  {info.initials}
                </div>
                {isSelected && (
                  <span
                    className="flex items-center justify-center w-5 h-5 rounded-full"
                    style={{ background: info.color }}
                  >
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="font-semibold text-[14px] text-slate-900 mt-3">
                {info.label}
              </div>
              <div className="text-[12px] text-slate-400 mt-0.5">
                {roleCounts[role]} member{roleCounts[role] === 1 ? "" : "s"} ·{" "}
                {permissionCountFor(matrix, role)} permission{permissionCountFor(matrix, role) === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected role — permissions, editable inline */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-lg text-[12px] font-bold"
              style={{ background: `${selectedInfo.color}1A`, color: selectedInfo.color }}
            >
              {selectedInfo.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[15px] text-slate-900">
                  {selectedInfo.label}
                </span>
                {selectedInfo.badge && (
                  <span
                    className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ background: `${selectedInfo.color}1A`, color: selectedInfo.color }}
                  >
                    {selectedInfo.badge}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-[12.5px] mt-0.5 max-w-xl leading-relaxed">
                {selectedInfo.description}
              </p>
            </div>
          </div>

          {isSuperAdmin && !editMode && (
            <button
              onClick={startEditing}
              disabled={matrixLoading || !matrix}
              className="flex items-center flex-shrink-0 gap-2 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 transition-colors disabled:opacity-60"
            >
              <Settings2 className="w-3.5 h-3.5" /> Edit Permissions
            </button>
          )}
          {isSuperAdmin && editMode && (
            <div className="flex items-center flex-shrink-0 gap-2">
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
            Switch permissions on or off for {selectedInfo.label}, then use the other
            role cards above to edit them too — Save Changes applies everything at once.
          </div>
        )}

        {matrixLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 px-5 pt-4">
              <Eyebrow>
                {permissionCountFor(matrix, selectedRole)} of {TOTAL_PERMISSIONS} permissions granted
              </Eyebrow>
              <div className="relative">
                <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-2.5 top-1/2 text-slate-400" />
                <input
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                  placeholder="Search permissions..."
                  className="pl-8 pr-3 py-1.5 w-52 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="px-5 pb-5">
              {visibleGroups.length === 0 ? (
                <p className="py-10 text-center text-slate-400 text-[13px]">
                  No permissions match "{permissionSearch}".
                </p>
              ) : (
                visibleGroups.map((group) => {
                  const CategoryIcon = CATEGORY_ICONS[group.category] || ShieldCheck;
                  return (
                    <div key={group.category} className="pt-4 first:pt-3">
                      <div className="flex items-center gap-1.5 pb-1.5">
                        <CategoryIcon className="w-3.5 h-3.5 text-slate-400" />
                        <div className="text-[10px] tracking-[0.08em] uppercase text-slate-400 font-semibold">
                          {group.category}
                        </div>
                      </div>
                      {group.items.map((item) => {
                        const granted = hasPermission(activeMatrix, selectedRole, item);
                        const interactive = editMode && item.editable && isSuperAdmin;
                        return (
                          <div
                            key={item.key}
                            className="flex items-center justify-between gap-3 py-2 border-t border-slate-100 first:border-t-0"
                          >
                            <span className={`text-[13px] ${granted ? "text-slate-700" : "text-slate-400"}`}>
                              {item.label}
                            </span>
                            {item.editable ? (
                              interactive ? (
                                <button
                                  type="button"
                                  onClick={() => toggleDraftCell(selectedRole, item.key)}
                                  title={`Toggle "${item.label}" for ${selectedInfo.label}`}
                                >
                                  <ToggleSwitch checked={granted} />
                                </button>
                              ) : (
                                <ToggleSwitch checked={granted} disabled />
                              )
                            ) : (
                              <span
                                className="flex items-center gap-1 text-[11px] font-medium text-slate-400"
                                title="Not backed by a configurable permission — always the same for every role"
                              >
                                <Lock className="w-3 h-3" />
                                {granted ? "Always on" : "Off"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Assign roles to members */}
      <div className="overflow-hidden bg-white border rounded-md border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <div className="font-semibold text-[15px] text-slate-900">
              Assign roles to members
            </div>
          </div>
          <div className="relative">
            <Search className="absolute w-3.5 h-3.5 -translate-y-1/2 left-2.5 top-1/2 text-slate-400" />
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members..."
              className="pl-8 pr-3 py-1.5 w-52 text-[12px] border border-slate-200 rounded-lg outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {(membersError || roleChangeError) && (
          <div className="m-5 p-3 text-[12px] font-medium border text-rose-700 bg-rose-50 rounded border-rose-100 flex items-center gap-2">
            <AlertCircle className="flex-shrink-0 w-4 h-4" />
            {membersError || roleChangeError}
          </div>
        )}

        {membersLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <p className="py-10 text-center text-slate-400 text-[13px]">
            No members match "{memberSearch}".
          </p>
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
                {filteredMembers.map((m) => {
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
