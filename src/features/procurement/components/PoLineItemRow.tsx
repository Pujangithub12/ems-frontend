import React from "react";
import { Trash2 } from "lucide-react";
import { cleanNumberText, formatPoMoney, rowTotal, type CustomCol, type ItemRow } from "../utils/poLineItems";

export const cellInputCls =
  "w-full h-full px-2.5 py-2 text-[12px] text-left text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:text-slate-600";

type Props = {
  row: ItemRow;
  index: number;
  customCols: CustomCol[];
  isAdmin: boolean;
  itemsBusy: boolean;
  /** Tab out of the very last row's last cell starts a new row, like a spreadsheet. */
  isLast: boolean;
  /** The PO's Currency field, shown as the prefix of the row total. */
  currency: string;
  onUpdate: (key: string, patch: Partial<ItemRow>) => void;
  onUpdateCustom: (rowKey: string, colKey: string, value: string) => void;
  onRemove: (key: string) => void;
  onAddRow: () => void;
};

/** One line-item row. Memoised: the parent keeps unchanged rows referentially equal and its handlers
 * stable, so typing in one cell re-renders only that row instead of the whole table. */
const PoLineItemRow = React.memo(function PoLineItemRow({ row, index, customCols, isAdmin, itemsBusy, isLast, currency, onUpdate, onUpdateCustom, onRemove, onAddRow }: Props) {
  const disabled = !isAdmin || itemsBusy;
  const total = rowTotal(row);
  return (
    <tr data-row-key={row.key} className="border-b border-slate-200 last:border-b-0">
      <td className="px-2.5 py-2 text-left text-slate-500 bg-slate-50/60 border-r border-slate-200">{index + 1}</td>
      <td className="p-0 border-r border-slate-200">
        <input
          disabled={disabled}
          value={row.itemName}
          onChange={(e) => onUpdate(row.key, { itemName: e.target.value })}
          placeholder="Item name"
          className={cellInputCls}
        />
      </td>
      <td className="p-0 border-r border-slate-200">
        <input disabled={disabled} value={row.hsnCode} onChange={(e) => onUpdate(row.key, { hsnCode: e.target.value })} className={cellInputCls} />
      </td>
      <td className="p-0 border-r border-slate-200">
        <input
          disabled={disabled}
          inputMode="decimal"
          value={row.quantity}
          onChange={(e) => onUpdate(row.key, { quantity: cleanNumberText(e.target.value) })}
          className={cellInputCls}
        />
      </td>
      <td className="p-0 border-r border-slate-200">
        <input
          disabled={disabled}
          value={row.unit}
          onChange={(e) => onUpdate(row.key, { unit: e.target.value })}
          placeholder="e.g. pcs"
          className={cellInputCls}
        />
      </td>
      {customCols.map((col) => (
        <td key={col.key} className="p-0 border-r border-slate-200">
          <input
            disabled={disabled}
            value={row.custom[col.key] ?? ""}
            onChange={(e) => onUpdateCustom(row.key, col.key, e.target.value)}
            className={cellInputCls}
          />
        </td>
      ))}
      <td className="p-0 border-r border-slate-200">
        <input
          disabled={disabled}
          inputMode="decimal"
          value={row.unitPrice}
          onChange={(e) => onUpdate(row.key, { unitPrice: cleanNumberText(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key === "Tab" && !e.shiftKey && isLast && isAdmin) {
              e.preventDefault();
              onAddRow();
            }
          }}
          className={cellInputCls}
        />
      </td>
      <td className="p-0 text-center border-r border-slate-200">
        <input
          type="checkbox"
          checked={row.taxable}
          disabled={disabled}
          onChange={(e) => onUpdate(row.key, { taxable: e.target.checked })}
          title={row.taxable ? "VAT applies to this item" : "VAT does not apply to this item"}
          aria-label="VAT applies"
          className="w-4 h-4 align-middle accent-blue-900"
        />
      </td>
      <td className="px-2.5 py-2 font-medium text-left text-slate-800 bg-slate-50/60 border-r border-slate-200">
        {total > 0 ? formatPoMoney(total, currency) : ""}
      </td>
      <td className="px-1 py-1 text-center">
        {isAdmin && (
          <button
            type="button"
            onClick={() => onRemove(row.key)}
            disabled={itemsBusy}
            tabIndex={-1}
            title="Remove row"
            className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={13} />
          </button>
        )}
      </td>
    </tr>
  );
});

export default PoLineItemRow;
