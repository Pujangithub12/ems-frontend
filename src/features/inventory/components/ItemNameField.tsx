import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { CatalogItem } from "../../../types";
import { useWorkspaceItemCatalogQuery, useCreateCatalogItemMutation } from "../hooks/useInventory";

interface ItemNameFieldProps {
  /** The linked catalog item's id, or null if this row isn't linked to the catalog (e.g. a legacy row, or nothing picked yet). */
  itemId: number | null;
  /** Fires when the user picks an existing catalog entry or adds a new one. */
  onSelect: (item: CatalogItem) => void;
  /** The row's current free-text name, shown as a placeholder option when itemId is null but a legacy name exists (e.g. editing a pre-catalog row). */
  currentName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Item Name field backed by the shared workspace item catalog (name + code),
 * so item naming stays consistent between the Inventory and Procurement
 * "Add item" forms — the value is a reference to a CatalogItem row, not
 * freehand text. The "Add new item" link opens a floating popover (not
 * inline layout) so it never shifts the rest of the form.
 */
const ItemNameField: React.FC<ItemNameFieldProps> = ({
  itemId,
  onSelect,
  currentName,
  placeholder,
  autoFocus,
  className,
}) => {
  const itemsQuery = useWorkspaceItemCatalogQuery();
  const items = itemsQuery.data ?? [];
  const createMutation = useCreateCatalogItemMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAdd) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowAdd(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      await itemsQuery.refetch();
      onSelect(created);
      setShowAdd(false);
      setNewName("");
      setNewCode("");
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to add item");
    }
  };

  const showLegacyOption = !itemId && currentName;

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1 min-w-0">
          <select
            autoFocus={autoFocus}
            value={itemId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              const match = items.find((i) => i.id === id);
              if (match) onSelect(match);
            }}
            className={`${className ?? ""} appearance-none cursor-pointer pr-8 ${itemId ? "" : "text-slate-400"}`}
          >
            <option value="" disabled>
              {showLegacyOption ? `${currentName} (not linked)` : placeholder || "Select an item"}
            </option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.code ? ` (${i.code})` : ""}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((s) => !s)}
          className="flex items-center flex-shrink-0 gap-1 px-1 py-1 text-[11px] font-medium whitespace-nowrap text-blue-700 hover:text-blue-800 hover:underline"
        >
          <Plus size={11} /> Add new item
        </button>
      </div>
      {showAdd && (
        <div className="absolute right-0 z-20 p-2 mt-1 space-y-2 bg-white border rounded-lg shadow-lg top-full w-60 border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Add new item</span>
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
            placeholder="Item name"
            className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
          />
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Item code (optional)"
            className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-400"
          />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <button
            type="button"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={handleAdd}
            className="w-full px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding..." : "Add item"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ItemNameField;
