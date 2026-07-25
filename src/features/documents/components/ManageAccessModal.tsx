import React, { useEffect, useState } from "react";
import { Lock, Loader2, Plus, X, Users as UsersIcon } from "lucide-react";
import { ProjectFile } from "../../../types";
import { useUsers } from "../../users/hooks/useUsers";
import { useFileAccessQuery, useSetFileAccessMutation } from "../hooks/useFileAccess";
import { getErrorMessage } from "../../../lib/errors";

type Level = "none" | "read" | "write";

type DraftEntry = {
  key: string;
  granteeType: "user" | "role";
  userId?: number;
  role?: string;
  level: Level;
};

const ROLE_OPTIONS = [
  { value: "finance", label: "Finance (role)" },
  { value: "user", label: "Standard User (role)" },
];

const LEVEL_COLUMNS: { level: Level; label: string }[] = [
  { level: "read", label: "Read Only" },
  { level: "write", label: "Read & Write" },
  { level: "none", label: "No Access" },
];

/**
 * Admin/super_admin only — edits the explicit FileAccess grants on one file
 * or folder. Nothing set here means "inherit from the parent folder" (or, at
 * the root, closed by default) — see backend/src/utils/fileAccess.ts.
 */
const ManageAccessModal: React.FC<{
  file: ProjectFile | null;
  onClose: () => void;
}> = ({ file, onClose }) => {
  const accessQuery = useFileAccessQuery(file?.id ?? null);
  const usersQuery = useUsers();
  const users = usersQuery.data ?? [];
  const setAccessMutation = useSetFileAccessMutation();

  const [draft, setDraft] = useState<DraftEntry[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (accessQuery.data) {
      setDraft(
        accessQuery.data.map((g) => ({
          key: `${g.granteeType}:${g.granteeType === "user" ? g.user?.id : g.role}`,
          granteeType: g.granteeType,
          userId: g.user?.id,
          role: g.role,
          level: g.level,
        })),
      );
    }
  }, [accessQuery.data]);

  if (!file) return null;

  const setLevel = (key: string, granteeType: "user" | "role", idOrRole: number | string, level: Level) => {
    setDraft((prev) => {
      const existing = prev.find((d) => d.key === key);
      if (existing && existing.level === level) {
        return prev.filter((d) => d.key !== key);
      }
      if (existing) {
        return prev.map((d) => (d.key === key ? { ...d, level } : d));
      }
      const entry: DraftEntry =
        granteeType === "user"
          ? { key, granteeType, userId: idOrRole as number, level }
          : { key, granteeType, role: idOrRole as string, level };
      return [...prev, entry];
    });
  };

  const handleSave = async () => {
    setError(null);
    try {
      await setAccessMutation.mutateAsync({
        fileId: file.id,
        grants: draft.map((d) => ({
          granteeType: d.granteeType,
          ...(d.granteeType === "user" ? { userId: d.userId } : { role: d.role }),
          level: d.level,
        })),
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update access."));
    }
  };

  const labelFor = (entry: DraftEntry) => {
    if (entry.granteeType === "role") {
      return ROLE_OPTIONS.find((r) => r.value === entry.role)?.label || entry.role || "--";
    }
    const user = users.find((u) => u.id === entry.userId);
    return user ? user.fullName : "Unknown user";
  };

  const rows: { key: string; granteeType: "user" | "role"; id: number | string; label: string }[] = [
    ...ROLE_OPTIONS.map((r) => ({ key: `role:${r.value}`, granteeType: "role" as const, id: r.value, label: r.label })),
    ...users.map((u) => ({ key: `user:${u.id}`, granteeType: "user" as const, id: u.id, label: u.fullName })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden bg-white border shadow-2xl rounded-2xl border-slate-100">
        <div className="flex items-start justify-between px-6 pt-6 pb-5">
          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold text-slate-900 truncate">Manage Access</h3>
            <p className="text-[13px] text-slate-500 truncate mt-0.5">{file.name}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="border-t border-slate-100" />

        <div className="px-6 py-5 space-y-5 max-h-[65vh] overflow-y-auto">
          <div className="flex items-start gap-2.5 p-3.5 text-[12.5px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-100 rounded-xl">
            <Lock size={14} className="flex-shrink-0 mt-0.5 text-slate-400" />
            <span>
              Anyone not listed below has no access, unless a parent folder grants it to them — new
              files/folders are closed by default. Admins and super admins always have full access.
            </span>
          </div>

          {error && (
            <div className="px-3.5 py-2.5 text-[12.5px] text-red-700 bg-red-50 border border-red-100 rounded-xl">{error}</div>
          )}

          {accessQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
            </div>
          ) : !formOpen ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">People with access</p>
              {draft.length === 0 ? (
                <p className="py-6 text-center text-slate-400 text-[12.5px] bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                  No one has explicit access yet.
                </p>
              ) : (
                <div className="overflow-y-auto border divide-y rounded-xl border-slate-200 divide-slate-100 max-h-[112px]">
                  {draft.map((entry) => {
                    const badge =
                      entry.level === "write"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : entry.level === "read"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : "bg-slate-100 text-slate-500 border-slate-200";
                    return (
                      <div key={entry.key} className="flex items-center gap-3 px-3.5 py-2.5">
                        {entry.granteeType === "role" ? (
                          <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-500">
                            <UsersIcon size={14} />
                          </span>
                        ) : (
                          <span className="flex items-center justify-center flex-shrink-0 w-8 h-8 text-[11px] font-semibold text-white rounded-full bg-slate-500">
                            {labelFor(entry).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-800 truncate">{labelFor(entry)}</p>
                          {entry.granteeType === "role" && <p className="text-[11px] text-slate-400">Role</p>}
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-medium border rounded-full whitespace-nowrap ${badge}`}>
                          {LEVEL_COLUMNS.find((l) => l.level === entry.level)?.label}
                        </span>
                        <button
                          onClick={() => setDraft((prev) => prev.filter((d) => d.key !== entry.key))}
                          title="Remove access"
                          className="flex-shrink-0 p-1 rounded text-slate-300 hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => setFormOpen(true)}
                className="flex items-center gap-1.5 pt-1 text-[13px] font-medium text-blue-700 hover:text-blue-800"
              >
                <Plus size={14} /> Add person or role
              </button>
            </div>
          ) : (
            <div className="overflow-hidden border rounded-xl border-slate-200">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 border-slate-100">
                <span className="text-[12.5px] font-semibold text-slate-600">Set access per person</span>
                <button
                  onClick={() => setFormOpen(false)}
                  className="text-[12.5px] font-medium text-blue-700 hover:underline"
                >
                  Done
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-white border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 font-medium text-left text-slate-500">Name</th>
                      {LEVEL_COLUMNS.map((col) => (
                        <th key={col.level} className="px-3 py-2 font-medium text-center text-slate-500 whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const existing = draft.find((d) => d.key === row.key);
                      return (
                        <tr key={row.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="flex items-center gap-2.5 px-4 py-2 text-slate-800">
                            {row.granteeType === "role" ? (
                              <UsersIcon size={12} className="flex-shrink-0 text-slate-400" />
                            ) : (
                              <span className="flex items-center justify-center flex-shrink-0 w-5 h-5 text-[9px] font-semibold text-white rounded-full bg-slate-500">
                                {row.label.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate">{row.label}</span>
                          </td>
                          {LEVEL_COLUMNS.map((col) => (
                            <td key={col.level} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={existing?.level === col.level}
                                onChange={() => setLevel(row.key, row.granteeType, row.id, col.level)}
                                className="w-4 h-4 rounded cursor-pointer accent-blue-800"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pt-1 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={setAccessMutation.isPending}
            className="flex items-center justify-center flex-1 gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded-xl hover:bg-blue-800 disabled:opacity-60 shadow-sm"
          >
            {setAccessMutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Save Access
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageAccessModal;
