import React, { useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, Eye, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import { getErrorMessage } from "../../../lib/errors";
import { useColumnWidths } from "../hooks/useColumnWidths";
import { useSaveRequisitionMutation } from "../hooks/useRequisitions";
import type { RequisitionRecord } from "../api/requisition.api";
import type { RequisitionFormData } from "../pdf/generatePdf";
import PdfPreviewModal from "./PdfPreviewModal";

const inputCls = "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
const sectionTitle = "text-[13px] font-semibold text-blue-900";
// Spreadsheet-style cell input, same as the Purchase Order line-item table.
const cellInputCls =
  "w-full h-full px-2.5 py-2 text-[12px] text-left text-slate-800 bg-transparent border-0 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500";

/** How wide each item-table column starts out (description and comment share the leftover width; added columns get 160px). */
const ITEM_COL_DEFAULTS: Record<string, number> = { sn: 64, unit: 112, qty: 112, actions: 64 };
const ITEM_COL_FLEXIBLE = ["desc", "comment"];

const today = () => new Date().toISOString().slice(0, 10);

type Item = RequisitionFormData["items"][number];
const blankItem = (): Item => ({ description: "", unit: "", qty: "", comment: "", custom: {} });
const newColKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankRequisitionForm = (): RequisitionFormData => ({
  requisitionNo: "",
  date: today(),
  requestedBy: "",
  projectLocation: "",
  priority: "normal",
  items: [blankItem(), blankItem(), blankItem()],
  itemColumns: [],
  reason: "",
  preferredSupplier: "",
  suggestedBrand: "",
  deliveryLocation: "",
  specialInstructions: "",
  approvals: [
    { name: "", date: "" },
    { name: "", date: "" },
    { name: "", date: "" },
  ],
});

const APPROVAL_TITLES = ["Prepared / Requested By", "Procurement Officer", "Final Approver"];

/**
 * The Purchase Requisition form in a popup — opened from the Requisition list either blank ("New
 * Requisition", `record` = null) or with a saved requisition's details (clicking a row). The fields
 * mirror the paper form: header block, item grid, reason, procurement details, approvals. Edits only
 * count as saved once "Save Changes" is clicked; "Preview PDF" shows the finished, printable form.
 * The parent should give it a `key` per record so every opening starts from fresh state.
 */
const RequisitionFormModal: React.FC<{ record: RequisitionRecord | null; onClose: () => void }> = ({ record, onClose }) => {
  const { user, organization } = useAuth();

  const [form, setForm] = useState<RequisitionFormData>(() => {
    if (record) return { ...blankRequisitionForm(), ...record.data };
    const fresh = blankRequisitionForm();
    fresh.requestedBy = user?.fullName ?? "";
    fresh.approvals[0].name = user?.fullName ?? "";
    return fresh;
  });
  // The saved requisition being edited (null = a new one that hasn't been saved yet), and what was last saved.
  const [currentId, setCurrentId] = useState<number | null>(record?.id ?? null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(form));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const saveMutation = useSaveRequisitionMutation();
  // S.N., Description, Unit, Qty., any user-added columns (left of Comment), Comment, Actions.
  const itemCols = useMemo(() => ["sn", "desc", "unit", "qty", ...form.itemColumns.map((c) => c.key), "comment", "actions"], [form.itemColumns]);
  const { tableRef, widthOf, tableMinWidth, startResize, resetWidth } = useColumnWidths(itemCols, {
    storageKey: "requisition-item-col-widths",
    defaults: ITEM_COL_DEFAULTS,
    flexibleIds: ITEM_COL_FLEXIBLE,
  });
  // Heading input of a column that was just added, to put the cursor in.
  const [focusColKey, setFocusColKey] = useState<string | null>(null);
  // Row to put the cursor in after it was just added (Add Row / Tab out of the last cell).
  const [focusRow, setFocusRow] = useState<number | null>(null);

  useEffect(() => {
    if (focusRow === null) return;
    tableRef.current?.querySelector<HTMLInputElement>(`tbody tr:nth-child(${focusRow + 1}) input`)?.focus();
    setFocusRow(null);
  }, [focusRow, tableRef]);

  useEffect(() => {
    if (focusColKey === null) return;
    tableRef.current?.querySelector<HTMLInputElement>(`th[data-col-key="${focusColKey}"] input`)?.focus();
    setFocusColKey(null);
  }, [focusColKey, tableRef]);

  const dirty = JSON.stringify(form) !== savedSnapshot;

  const handleSave = async () => {
    setSaveError(null);
    try {
      const row = await saveMutation.mutateAsync({ id: currentId, data: form });
      setCurrentId(row.id);
      setSavedSnapshot(JSON.stringify(form));
    } catch (err) {
      setSaveError(getErrorMessage(err, "Failed to save the requisition."));
    }
  };

  const requestClose = () => {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    onClose();
  };

  // Leaving or refreshing the page with unsaved edits asks for confirmation first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof RequisitionFormData>(key: K, value: RequisitionFormData[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setItem = (i: number, patch: Partial<Item>) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  const addItemRow = () => {
    setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
    setFocusRow(form.items.length);
  };
  const addItemColumn = () => {
    const key = newColKey();
    setForm((f) => ({ ...f, itemColumns: [...f.itemColumns, { key, label: "" }] }));
    setFocusColKey(key);
  };
  const renameItemColumn = (key: string, label: string) =>
    setForm((f) => ({ ...f, itemColumns: f.itemColumns.map((c) => (c.key === key ? { ...c, label } : c)) }));
  const removeItemColumn = (key: string) =>
    setForm((f) => ({
      ...f,
      itemColumns: f.itemColumns.filter((c) => c.key !== key),
      items: f.items.map((it) => {
        const { [key]: _removed, ...rest } = it.custom ?? {};
        return { ...it, custom: rest };
      }),
    }));
  const setItemCustom = (i: number, key: string, value: string) =>
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, custom: { ...(it.custom ?? {}), [key]: value } } : it)) }));
  const resizeHandle = (id: string) => (
    <span
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => startResize(id, e)}
      onDoubleClick={() => resetWidth(id)}
      className="absolute top-0 right-0 z-10 w-2 h-full -mr-1 cursor-col-resize touch-none hover:bg-blue-400/50 active:bg-blue-500/60"
    />
  );
  const setApproval = (i: number, patch: Partial<RequisitionFormData["approvals"][number]>) =>
    setForm((f) => ({ ...f, approvals: f.approvals.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) as RequisitionFormData["approvals"] }));

  const orgDetails = {
    name: organization?.name ?? "Purchase Requisition",
    address: organization?.address,
    contact: organization?.contact,
    email: organization?.email,
  };
  const fileBase = `Requisition-${(form.requisitionNo || "draft").replace(/[\\/]/g, "-")}`;
  const generate = () => import("../pdf/generatePdf").then((m) => m.generateRequisitionPdf(form, orgDetails));

  const statusText = saveError ?? (dirty ? "Unsaved changes" : currentId ? "All changes saved" : "Nothing to save yet");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-slate-900/50 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-5xl my-4 overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
              <ClipboardList size={16} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-slate-900">
                {currentId ? `Requisition ${form.requisitionNo || `#${currentId}`}` : "New Requisition"}
              </h2>
              <p className="text-[12px] text-slate-500">Purchase Requisition Form</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[12px] ${saveError ? "text-red-600" : dirty ? "text-amber-600" : "text-emerald-600"}`}>{statusText}</span>
            <button
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <Check size={14} />} Save Changes
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              <Eye size={14} /> Preview PDF
            </button>
            <button onClick={requestClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col w-full gap-6 p-5 lg:p-6">
            {/* Header block */}
            <section className="p-4 space-y-3 border rounded-xl border-slate-200 bg-slate-50/50">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Requisition No.</label>
                  <input value={form.requisitionNo} onChange={(e) => set("requisitionNo", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Requested By</label>
                  <input value={form.requestedBy} onChange={(e) => set("requestedBy", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Project Location</label>
                  <input value={form.projectLocation} onChange={(e) => set("projectLocation", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <span className={labelCls}>Priority</span>
                <div className="flex items-center gap-5 pt-1">
                  {(["normal", "urgent"] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-[13px] text-slate-800 cursor-pointer">
                      <input type="radio" name="priority" checked={form.priority === p} onChange={() => set("priority", p)} className="accent-blue-900" />
                      {p === "normal" ? "Normal" : "Urgent"}
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* 1. Items */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className={sectionTitle}>1. Item Requisition Details</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addItemColumn}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <Plus size={13} /> Add Column
                  </button>
                  <button
                    onClick={addItemRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table ref={tableRef} className="w-full text-[12px] border-collapse" style={{ tableLayout: "fixed", minWidth: tableMinWidth }}>
                  <colgroup>
                    {itemCols.map((id) => (
                      <col key={id} data-col={id} style={{ width: widthOf(id) }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                      <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">S.N.{resizeHandle("sn")}</th>
                      <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Item Description / Specifications{resizeHandle("desc")}</th>
                      <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Unit{resizeHandle("unit")}</th>
                      <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Qty.{resizeHandle("qty")}</th>
                      {form.itemColumns.map((col) => (
                        <th key={col.key} data-col-key={col.key} className="relative p-0 font-medium text-left border-b border-r border-slate-200">
                          <div className="flex items-center">
                            <input
                              value={col.label}
                              onChange={(e) => renameItemColumn(col.key, e.target.value)}
                              placeholder="Column name"
                              className="flex-1 min-w-0 px-2.5 py-2 text-[11px] font-medium tracking-wide text-left text-slate-600 uppercase bg-transparent border-0 outline-none placeholder:normal-case placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-blue-500"
                            />
                            <button
                              type="button"
                              onClick={() => removeItemColumn(col.key)}
                              tabIndex={-1}
                              title="Remove column"
                              className="p-1 mr-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X size={12} />
                            </button>
                          </div>
                          {resizeHandle(col.key)}
                        </th>
                      ))}
                      <th className="relative px-2.5 py-2 font-medium text-left border-b border-r border-slate-200">Comment{resizeHandle("comment")}</th>
                      <th className="px-2.5 py-2 font-medium text-center border-b border-slate-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-200 last:border-b-0">
                        <td className="px-2.5 py-2 text-left text-slate-500 bg-slate-50/60 border-r border-slate-200">{i + 1}</td>
                        <td className="p-0 border-r border-slate-200">
                          <input
                            value={item.description}
                            onChange={(e) => setItem(i, { description: e.target.value })}
                            placeholder="Item description / specifications"
                            className={cellInputCls}
                          />
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input value={item.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="e.g. Nos" className={cellInputCls} />
                        </td>
                        <td className="p-0 border-r border-slate-200">
                          <input value={item.qty} onChange={(e) => setItem(i, { qty: e.target.value })} className={cellInputCls} />
                        </td>
                        {form.itemColumns.map((col) => (
                          <td key={col.key} className="p-0 border-r border-slate-200">
                            <input value={item.custom?.[col.key] ?? ""} onChange={(e) => setItemCustom(i, col.key, e.target.value)} className={cellInputCls} />
                          </td>
                        ))}
                        <td className="p-0 border-r border-slate-200">
                          <input
                            value={item.comment}
                            onChange={(e) => setItem(i, { comment: e.target.value })}
                            onKeyDown={(e) => {
                              // Tab out of the very last cell starts a new row, like a spreadsheet.
                              if (e.key === "Tab" && !e.shiftKey && i === form.items.length - 1) {
                                e.preventDefault();
                                addItemRow();
                              }
                            }}
                            className={cellInputCls}
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => set("items", form.items.filter((_, idx) => idx !== i))}
                            disabled={form.items.length <= 1}
                            tabIndex={-1}
                            title="Remove row"
                            className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 2. Reason */}
            <section className="space-y-2">
              <h3 className={sectionTitle}>2. Reason for Requisition</h3>
              <textarea rows={4} value={form.reason} onChange={(e) => set("reason", e.target.value)} className={`${inputCls} resize-y`} />
            </section>

            {/* 3. Procurement details */}
            <section className="space-y-3">
              <h3 className={sectionTitle}>3. Procurement Details</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Preferred supplier (if any)</label>
                  <input value={form.preferredSupplier} onChange={(e) => set("preferredSupplier", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Suggested brand / specification</label>
                  <input value={form.suggestedBrand} onChange={(e) => set("suggestedBrand", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Delivery location</label>
                  <input value={form.deliveryLocation} onChange={(e) => set("deliveryLocation", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Special instructions</label>
                  <input value={form.specialInstructions} onChange={(e) => set("specialInstructions", e.target.value)} className={inputCls} />
                </div>
              </div>
            </section>

            {/* 4. Approval */}
            <section className="space-y-3">
              <h3 className={sectionTitle}>4. Approval &amp; Authorization</h3>
              <p className="text-[12px] text-slate-500">Names and dates are optional — leave them blank to sign by hand on the printed form. Signatures are always left blank.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {APPROVAL_TITLES.map((title, i) => (
                  <div key={title} className="p-3 space-y-2 border rounded-xl border-slate-200">
                    <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">{title}</span>
                    <div>
                      <label className={labelCls}>Name</label>
                      <input value={form.approvals[i]!.name} onChange={(e) => setApproval(i, { name: e.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={form.approvals[i]!.date} onChange={(e) => setApproval(i, { date: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-end gap-2 pb-2">
              <button
                onClick={requestClose}
                className="px-5 py-2.5 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={!dirty || saveMutation.isPending}
                className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {dirty ? <Save size={15} /> : <Check size={15} />} Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewOpen && <PdfPreviewModal generate={generate} fileName={`${fileBase}.pdf`} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
};

export default RequisitionFormModal;
