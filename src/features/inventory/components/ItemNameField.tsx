import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Plus } from "lucide-react";
import { CatalogItem } from "../../../types";
import { useOrganizationId } from "../../../hooks/useOrganizationId";
import { useOrganizationItemCatalogQuery } from "../hooks/useInventory";

interface ItemNameFieldProps {
  itemId: number | null;
  onSelect: (item: CatalogItem) => void;
  /** The row's current free-text name, shown as a placeholder option when itemId is null but a legacy name exists (e.g. editing a pre-catalog row). */
  currentName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Overrides the default "Add new item" behavior (navigating to the Items page) — e.g. to
   * open CatalogItemFormModal in place instead, so the caller's own form/modal isn't lost. */
  onAddNew?: () => void;
}

/** Height of one option row (py-2 + text line) — 8 rows visible before the list scrolls. */
const OPTION_ROW_HEIGHT = 32;
const VISIBLE_OPTION_COUNT = 8;

const ItemNameField: React.FC<ItemNameFieldProps> = ({
  itemId,
  onSelect,
  currentName,
  placeholder,
  autoFocus,
  className,
  onAddNew,
}) => {
  const itemsQuery = useOrganizationItemCatalogQuery();
  const items = itemsQuery.data ?? [];
  const organizationId = useOrganizationId();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const showLegacyOption = !itemId && currentName;
  const selected = items.find((i) => i.id === itemId);
  const label = selected
    ? `${selected.name}${selected.code ? ` (${selected.code})` : ""}`
    : showLegacyOption
      ? `${currentName} (not linked)`
      : placeholder || "Select an item";

  return (
    <div className="flex items-center gap-1.5">
      <div ref={rootRef} className="relative flex-1 min-w-0">
        <button
          ref={toggleRef}
          type="button"
          autoFocus={autoFocus}
          onClick={() => setOpen((v) => !v)}
          className={`${className ?? ""} w-full text-left pr-8 cursor-pointer ${itemId ? "" : "text-slate-400"}`}
        >
          {label}
        </button>
        <ChevronDown className="absolute -translate-y-1/2 pointer-events-none right-2.5 top-1/2 w-3.5 h-3.5 text-slate-400" />
        {open && (
          <div
            className="absolute left-0 right-0 z-50 mt-1 overflow-y-auto bg-white border rounded-lg shadow-lg border-slate-200"
            style={{ maxHeight: OPTION_ROW_HEIGHT * VISIBLE_OPTION_COUNT }}
          >
            {items.length === 0 ? (
              <div className="px-3 py-2 text-[12.5px] text-slate-400">No items yet</div>
            ) : (
              items.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    onSelect(i);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-slate-50 ${i.id === itemId ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-900"}`}
                  style={{ height: OPTION_ROW_HEIGHT }}
                >
                  {i.name}
                  {i.code ? ` (${i.code})` : ""}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => (onAddNew ? onAddNew() : navigate(`/${organizationId}/items`))}
        className="flex items-center flex-shrink-0 gap-1 px-1 py-1 text-[11px] font-medium whitespace-nowrap text-blue-700 hover:text-blue-800 hover:underline"
      >
        <Plus size={11} /> Add new item
      </button>
    </div>
  );
};

export default ItemNameField;
