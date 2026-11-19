import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import { AccessInfo, AccessLevel, AccessPage, fetchAccess, saveAccess } from "../api/procurementAccess.api";

type Choice = AccessLevel;

const CHOICE_LABEL: Record<Choice, string> = { view: "View only", edit: "Can edit" };

/**
 * "Access management" for a whole page (Purchase Orders or Proforma Invoices). Every admin and finance
 * member can VIEW all records on the page, and finance can always edit them; this is where a super admin
 * gives selected admins permission to EDIT any record (an admin can always edit the ones they created).
 */
const AccessManagementModal: React.FC<{
  page: AccessPage;
  onClose: () => void;
}> = ({ page, onClose }) => {
  const queryClient = useQueryClient();
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyInfo = (data: AccessInfo) => {
    setInfo(data);
    setChoices(Object.fromEntries(data.grants.map((g) => [g.userId, g.level] as const)));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAccess(page)
      .then((data) => {
        if (!cancelled) applyInfo(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, "Failed to load access settings."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const dirty = useMemo(() => {
    if (!info) return false;
    const before = new Map(info.grants.map((g) => [g.userId, g.level] as const));
    return info.members.some((m) => (choices[m.id] ?? "view") !== (before.get(m.id) ?? "view"));
  }, [info, choices]);

  const handleSave = async () => {
    if (!info) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const grants = info.members.flatMap((m) => {
        // Viewing is the default for everyone, so only edit permissions are sent.
        return choices[m.id] === "edit" ? [{ userId: m.id, level: "edit" as const }] : [];
      });
      applyInfo(await saveAccess(page, grants));
      setSaved(true);
      // Lists and detail views are filtered by access, so make them refetch.
      void queryClient.invalidateQueries({
        predicate: (q) => q.queryKey.some((k) => typeof k === "string" && /purchaseOrder|proforma/i.test(k)),
      });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save access settings."));
    } finally {
      setSaving(false);
    }
  };

  const pageName = page === "purchase-orders" ? "Purchase Orders" : "Proforma Invoices";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-900" />
            <div>
              <h3 className="text-[14px] font-semibold text-slate-900">Manage Access</h3>
              <p className="text-[11px] text-slate-500">{pageName} page</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {error && <div className="px-3 py-2 mb-3 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">{error}</div>}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
            </div>
          ) : info && !info.canManage ? (
            <p className="py-6 text-[12px] text-center text-slate-500">Only a super admin can manage access to the {pageName} page.</p>
          ) : info ? (
            <>
              <p className="mb-3 text-[12px] text-slate-500">
                Admins can view all {pageName.toLowerCase()}, but can only edit the ones they created. Give edit permission to the admins who should be able to change <strong>any</strong> of them. Finance and super admins can always edit everything.
              </p>
              {info.members.length === 0 ? (
                <p className="py-6 text-[12px] text-center text-slate-400">There are no admins in this organization.</p>
              ) : (
                <div className="overflow-y-auto border divide-y rounded-lg max-h-80 divide-slate-100 border-slate-200">
                  {info.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">{m.fullName}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {m.email} · <span className="capitalize">{m.role}</span>
                        </p>
                      </div>
                      <select
                        value={choices[m.id] ?? "view"}
                        onChange={(e) => {
                          setSaved(false);
                          setChoices((prev) => ({ ...prev, [m.id]: e.target.value as Choice }));
                        }}
                        disabled={saving}
                        className="px-2 py-1.5 text-[12px] bg-white border rounded-lg border-slate-200 text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {(Object.keys(CHOICE_LABEL) as Choice[]).map((c) => (
                          <option key={c} value={c}>
                            {CHOICE_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          {saved && !dirty && <span className="mr-auto text-[12px] text-emerald-700">Access updated.</span>}
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white">
            Close
          </button>
          {info?.canManage && info.members.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />} Save access
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessManagementModal;
