import React from "react";
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

  const showLegacyOption = !itemId && currentName;

  return (
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
        onClick={() => (onAddNew ? onAddNew() : navigate(`/${organizationId}/items`))}
        className="flex items-center flex-shrink-0 gap-1 px-1 py-1 text-[11px] font-medium whitespace-nowrap text-blue-700 hover:text-blue-800 hover:underline"
      >
        <Plus size={11} /> Add new item
      </button>
    </div>
  );
};

export default ItemNameField;
