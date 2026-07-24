import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, X } from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import { useWorkspaceVendorsQuery, useCreateVendorMutation } from "../hooks/useInventory";

interface VendorFieldProps {
  /** The selected vendor's id, or null for "No vendor". */
  vendorId: number | null;
  /** Fires with the picked vendor's id (or null for "No vendor"), including right after adding a new one. */
  onSelect: (vendorId: number | null) => void;
}

/**
 * Vendor field for the Add/Edit Inventory Item form — select-only (never
 * free text), backed by the workspace's existing vendors. The "Add vendor"
 * link opens a floating popover (mirrors ItemNameField/WarehouseField),
 * rendered via a portal into document.body and positioned `fixed` off the
 * trigger button's own rect — needed because this field is normally used
 * inside a modal with `overflow-hidden`, which would otherwise clip an
 * absolutely-positioned popover that overflows the modal's bounds.
 */
const VendorField: React.FC<VendorFieldProps> = ({ vendorId, onSelect }) => {
  const vendorsQuery = useWorkspaceVendorsQuery();
  const vendors = vendorsQuery.data ?? [];
  const createMutation = useCreateVendorMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const openAdd = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ top: rect.bottom + 4, left: Math.max(8, rect.right - 240) });
    setShowAdd(true);
  };

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setShowAdd(false);
      }
    };
    const handleScroll = () => setShowAdd(false);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [showAdd]);

  const handleAdd = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        code: newCode.trim() || undefined,
      });
      await vendorsQuery.refetch();
      onSelect(created.id);
      setShowAdd(false);
      setNewName("");
      setNewCode("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add vendor"));
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        <select
          value={vendorId ?? ""}
          onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}
          className={`w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded appearance-none cursor-pointer outline-none focus:border-blue-400 ${vendorId ? "" : "text-slate-400"}`}
        >
          <option value="">No vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
      </div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (showAdd ? setShowAdd(false) : openAdd())}
        className="flex items-center flex-shrink-0 gap-1 px-1 py-1 text-[11px] font-medium whitespace-nowrap text-blue-700 hover:text-blue-800 hover:underline"
      >
        <Plus size={11} /> Add vendor
      </button>

      {showAdd && anchor && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: anchor.top, left: anchor.left }}
          className="z-[60] p-2 space-y-2 bg-white border rounded-lg shadow-lg w-60 border-slate-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Add vendor</span>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </button>
          </div>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Vendor name"
            className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
          />
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (optional)"
            className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
          />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            type="button"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={handleAdd}
            className="w-full px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding..." : "Add vendor"}
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default VendorField;
