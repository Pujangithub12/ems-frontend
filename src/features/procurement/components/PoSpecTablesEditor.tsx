import React from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { PurchaseOrder } from "../../../types";
import { handleRowArrowNav, inputCls, labelCls, sectionCardCls } from "../utils/poFormUi";

/** A free-form spec table on the Overview tab (PDF, right above Payment Terms) — title, column
 * headers and rows are all admin-defined, so it can match any spec sheet shape (a simple
 * S.N./label/value table, or a wider multi-column table with its own footer note). */
export type SpecTableForm = {
  title: string;
  columns: string[];
  footerNote: string;
  rows: string[][];
};

export const emptySpecTable = (): SpecTableForm => ({
  title: "",
  columns: ["S.N.", "Particulars", "Description"],
  footerNote: "",
  rows: [["", "", ""]],
});

export const specTablesFromPo = (po: PurchaseOrder): SpecTableForm[] =>
  (po.specTables || []).map((t) => ({
    title: t.title,
    columns: [...t.columns],
    footerNote: t.footerNote || "",
    rows: t.rows.map((r) => [...r.cells]),
  }));

type SetTables = React.Dispatch<React.SetStateAction<SpecTableForm[]>>;

/** Applies `fn` to the table at `idx` only — every other table keeps its identity, so its card doesn't re-render. */
const patchTable = (setTables: SetTables, idx: number, fn: (t: SpecTableForm) => SpecTableForm) =>
  setTables((prev) => prev.map((t, i) => (i === idx ? fn(t) : t)));

const SpecTableCard = React.memo(function SpecTableCard({
  table,
  tIdx,
  isAdmin,
  setTables,
}: {
  table: SpecTableForm;
  tIdx: number;
  isAdmin: boolean;
  setTables: SetTables;
}) {
  const patch = (fn: (t: SpecTableForm) => SpecTableForm) => patchTable(setTables, tIdx, fn);

  return (
    <div className="p-3 border rounded-lg border-slate-200">
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <label className={labelCls}>Table Title</label>
          <input
            disabled={!isAdmin}
            value={table.title}
            onChange={(e) => patch((t) => ({ ...t, title: e.target.value }))}
            placeholder="e.g. Technical Specification"
            className={inputCls}
          />
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTables((prev) => prev.filter((_, i) => i !== tIdx))}
            title="Remove table"
            className="flex-shrink-0 p-1.5 mt-5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <label className={labelCls}>Columns</label>
      <div className="flex items-start gap-1.5 mb-2">
        {table.columns.map((col, cIdx) => (
          <div key={cIdx} className="flex items-center flex-1 min-w-0 gap-1">
            <input
              disabled={!isAdmin}
              value={col}
              onChange={(e) => patch((t) => ({ ...t, columns: t.columns.map((c, ci) => (ci === cIdx ? e.target.value : c)) }))}
              className={`${inputCls} font-medium`}
            />
            {isAdmin && table.columns.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  patch((t) => ({
                    ...t,
                    columns: t.columns.filter((_, ci) => ci !== cIdx),
                    rows: t.rows.map((r) => r.filter((_, ci) => ci !== cIdx)),
                  }))
                }
                title="Remove column"
                className="flex-shrink-0 p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <button
            type="button"
            onClick={() => patch((t) => ({ ...t, columns: [...t.columns, `Column ${t.columns.length + 1}`], rows: t.rows.map((r) => [...r, ""]) }))}
            title="Add column"
            className="flex-shrink-0 p-2 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <label className={labelCls}>Rows</label>
      <div className="space-y-1.5">
        {table.rows.map((row, rIdx) => (
          <div key={rIdx} data-arrow-row className="flex items-center gap-1.5">
            {table.columns.map((col, cIdx) => (
              <input
                key={cIdx}
                disabled={!isAdmin}
                value={row[cIdx] ?? ""}
                onChange={(e) =>
                  patch((t) => ({
                    ...t,
                    rows: t.rows.map((r, ri) => (ri === rIdx ? r.map((c, ci) => (ci === cIdx ? e.target.value : c)) : r)),
                  }))
                }
                onKeyDown={handleRowArrowNav}
                placeholder={col}
                className={`${inputCls} flex-1 min-w-0`}
              />
            ))}
            {isAdmin && (
              <button
                type="button"
                onClick={() => patch((t) => ({ ...t, rows: t.rows.filter((_, ri) => ri !== rIdx) }))}
                title="Remove row"
                className="flex-shrink-0 p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => patch((t) => ({ ...t, rows: [...t.rows, t.columns.map(() => "")] }))}
          className="flex items-center gap-1 mt-2 text-[11px] font-medium text-blue-700 hover:underline"
        >
          <Plus size={12} /> Add Row
        </button>
      )}

      <div className="mt-3">
        <label className={labelCls}>Footer Note (optional)</label>
        <input
          disabled={!isAdmin}
          value={table.footerNote}
          onChange={(e) => patch((t) => ({ ...t, footerNote: e.target.value }))}
          placeholder="e.g. Motors Make – Havells (RPM 1440)"
          className={inputCls}
        />
      </div>
    </div>
  );
});

/** The "Specification Tables" card — add/remove tables, rename/add/remove columns, add/remove rows, edit cells. */
const PoSpecTablesEditor: React.FC<{ tables: SpecTableForm[]; setTables: SetTables; isAdmin: boolean }> = ({ tables, setTables, isAdmin }) => (
  <div className={sectionCardCls}>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">Specification Tables</h3>
        <p className="mt-0.5 text-[11px] text-slate-400">
          Shown on the PDF right above Payment Terms (e.g. "Technical Specification", "Electricity Requirement", "Electrical Motor data...") — a table with no title or no rows doesn't appear at all. Add as many as you need, each with its own columns.
        </p>
      </div>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setTables((prev) => [...prev, emptySpecTable()])}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 w-fit"
        >
          <Plus size={13} /> Add Table
        </button>
      )}
    </div>
    {tables.length === 0 ? (
      <p className="text-[12px] text-slate-400">No spec tables added.</p>
    ) : (
      <div className="space-y-4">
        {tables.map((table, tIdx) => (
          <SpecTableCard key={tIdx} table={table} tIdx={tIdx} isAdmin={isAdmin} setTables={setTables} />
        ))}
      </div>
    )}
  </div>
);

export default PoSpecTablesEditor;
