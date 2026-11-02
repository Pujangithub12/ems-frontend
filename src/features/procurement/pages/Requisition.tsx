import React, { useEffect, useState } from "react";
import { ClipboardList, Eye, Plus, Trash2, FilePlus2, Save, Check, History, X, Loader2, FolderOpen } from "lucide-react";
import { useAuth } from "../../../context/AuthProvider";
import PdfPreviewModal from "../components/PdfPreviewModal";
import { preloadPdfFonts } from "../pdf/pdfFonts";
import { getErrorMessage } from "../../../lib/errors";
import { useRequisitionsQuery, useSaveRequisitionMutation, useDeleteRequisitionMutation } from "../hooks/useRequisitions";
import type { RequisitionRecord } from "../api/requisition.api";
import type { RequisitionFormData } from "../pdf/generatePdf";

// The PDF is drawn in the browser (see ../pdf/generatePdf.ts): warm the fonts and the (lazy)
// pdfkit chunk in the background so "Preview PDF" opens without waiting on either.
preloadPdfFonts();
void import("../pdf/generatePdf");

const inputCls = "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-400";
const labelCls = "block mb-1 text-[11px] font-medium text-slate-900";
const sectionTitle = "text-[13px] font-semibold text-blue-900";

const today = () => new Date().toISOString().slice(0, 10);

type Item = RequisitionFormData["items"][number];
const blankItem = (): Item => ({ description: "", unit: "", qty: "", comment: "" });

const blankForm = (): RequisitionFormData => ({
  requisitionNo: "",
  date: today(),
  requestedBy: "",
  projectLocation: "",
  priority: "normal",
  items: [blankItem(), blankItem(), blankItem()],
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
 * Purchase Requisition Form — fill in the fields below (they mirror the paper form: header block,
 * item grid, reason, procurement details, approvals), then "Preview PDF" to see the finished
 * form, laid out like the printed one, and download it.
 */
const Requisition: React.FC = () => {
  const { user, organization } = useAuth();
  const freshForm = (): RequisitionFormData => {
    const fresh = blankForm();
    fresh.requestedBy = user?.fullName ?? "";
    fresh.approvals[0].name = user?.fullName ?? "";
    return fresh;
  };
  const [form, setForm] = useState<RequisitionFormData>(freshForm);
  // The saved requisition being edited (null = a new one that hasn't been saved yet), and what was
  // last saved: edits only count as saved once "Save Changes" is clicked.
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(form));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const saveMutation = useSaveRequisitionMutation();

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

  const confirmDiscard = () => !dirty || window.confirm("You have unsaved changes. Discard them?");

  /** Starts a blank requisition (the previous one stays in History). */
  const startNew = () => {
    if (!confirmDiscard()) return;
    const fresh = freshForm();
    setForm(fresh);
    setCurrentId(null);
    setSavedSnapshot(JSON.stringify(fresh));
    setSaveError(null);
  };

  /** Loads a requisition from History back into the form. */
  const openRecord = (rec: RequisitionRecord) => {
    if (!confirmDiscard()) return;
    const loaded = { ...blankForm(), ...rec.data };
    setForm(loaded);
    setCurrentId(rec.id);
    setSavedSnapshot(JSON.stringify(loaded));
    setSaveError(null);
    setHistoryOpen(false);
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
  const setApproval = (i: number, patch: Partial<RequisitionFormData["approvals"][number]>) =>
    setForm((f) => ({ ...f, approvals: f.approvals.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) as RequisitionFormData["approvals"] }));

  const orgDetails = {
    name: organization?.name ?? "Purchase Requisition",
    address: organization?.address,
    contact: organization?.contact,
    email: organization?.email,
  };
  const fileBase = `Requisition-${(form.requisitionNo || "draft").replace(/[\\/]/g, "-")}`;
  const generate = () =>
    import("../pdf/generatePdf").then((m) => m.generateRequisitionPdf(form, orgDetails));

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full max-w-4xl gap-6 mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center flex-shrink-0 w-9 h-9 text-blue-900 rounded-full bg-blue-50">
              <ClipboardList size={16} />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900">Purchase Requisition Form</h2>
              <p className="text-[12px] text-slate-500">Fill in the form, then preview it as a PDF.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[12px] ${saveError ? "text-red-600" : dirty ? "text-amber-600" : "text-emerald-600"}`}>
              {saveError ?? (dirty ? "Unsaved changes" : currentId ? "All changes saved" : "Nothing to save yet")}
            </span>
            <button
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <Check size={14} />} Save Changes
            </button>
            <button
              onClick={startNew}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <FilePlus2 size={13} /> New
            </button>
            <button
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <History size={13} /> History
            </button>
            <button
              onClick={() => setPreviewOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              <Eye size={14} /> Preview PDF
            </button>
          </div>
        </div>

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
          <h3 className={sectionTitle}>1. Item Requisition Details</h3>
          <div className="overflow-x-auto border rounded-xl border-slate-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="w-12 px-2 py-2 text-[11.5px] font-semibold text-center text-slate-700">S.N.</th>
                  <th className="px-2 py-2 text-[11.5px] font-semibold text-slate-700">Item Description / Specifications</th>
                  <th className="w-24 px-2 py-2 text-[11.5px] font-semibold text-slate-700">Unit</th>
                  <th className="w-24 px-2 py-2 text-[11.5px] font-semibold text-slate-700">Qty.</th>
                  <th className="px-2 py-2 text-[11.5px] font-semibold text-slate-700">Comment</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i} className="align-top border-t border-slate-200">
                    <td className="px-2 py-2 text-[12px] text-center text-slate-500">{i + 1}</td>
                    <td className="p-1.5">
                      <textarea
                        rows={2}
                        value={item.description}
                        onChange={(e) => setItem(i, { description: e.target.value })}
                        className={`${inputCls} resize-y`}
                      />
                    </td>
                    <td className="p-1.5">
                      <input value={item.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="e.g. Nos" className={inputCls} />
                    </td>
                    <td className="p-1.5">
                      <input value={item.qty} onChange={(e) => setItem(i, { qty: e.target.value })} className={inputCls} />
                    </td>
                    <td className="p-1.5">
                      <textarea rows={2} value={item.comment} onChange={(e) => setItem(i, { comment: e.target.value })} className={`${inputCls} resize-y`} />
                    </td>
                    <td className="p-1.5">
                      <button
                        onClick={() => set("items", form.items.filter((_, idx) => idx !== i))}
                        disabled={form.items.length <= 1}
                        className="flex items-center justify-center w-7 h-7 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-30"
                        title="Remove row"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => set("items", [...form.items, blankItem()])}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Plus size={13} /> Add Row
          </button>
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

        <div className="flex justify-end gap-2 pb-4">
          <button
            onClick={handleSave}
            disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {dirty ? <Save size={15} /> : <Check size={15} />} Save Changes
          </button>
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
          >
            <Eye size={15} /> Preview PDF
          </button>
        </div>
      </div>

      {previewOpen && <PdfPreviewModal generate={generate} fileName={`${fileBase}.pdf`} onClose={() => setPreviewOpen(false)} />}
      {historyOpen && (
        <HistoryModal
          currentId={currentId}
          organization={orgDetails}
          onOpen={openRecord}
          onDeleted={(id) => {
            if (id === currentId) {
              // The requisition being edited was deleted: whatever is on screen is now unsaved.
              setCurrentId(null);
              setSavedSnapshot("");
            }
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "--";
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Every saved requisition, newest first — open one back into the form, preview its PDF, or delete it. */
const HistoryModal: React.FC<{
  currentId: number | null;
  organization: { name: string; address?: string | null; contact?: string | null; email?: string | null };
  onOpen: (rec: RequisitionRecord) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
}> = ({ currentId, organization, onOpen, onDeleted, onClose }) => {
  const historyQuery = useRequisitionsQuery();
  const deleteMutation = useDeleteRequisitionMutation();
  const [previewing, setPreviewing] = useState<RequisitionRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const rows = historyQuery.data ?? [];

  const handleDelete = async (rec: RequisitionRecord) => {
    if (!window.confirm(`Delete requisition ${rec.requisitionNo || `#${rec.id}`}? This can't be undone.`)) return;
    setDeletingId(rec.id);
    try {
      await deleteMutation.mutateAsync(rec.id);
      onDeleted(rec.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-4xl max-h-[85vh] overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-[14px] font-semibold text-slate-900">Requisition History</h3>
            <p className="text-[11px] text-slate-500">Every requisition that has been saved, newest first.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {historyQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
            </div>
          ) : historyQuery.isError ? (
            <p className="py-16 text-center text-[13px] text-red-600">{getErrorMessage(historyQuery.error, "Failed to load history.")}</p>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-slate-500">No requisitions saved yet. Fill in the form and click Save Changes.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {["Requisition No.", "Date", "Requested By", "Priority", "Items", "Created By", "Saved", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-[11.5px] font-semibold text-slate-700 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((rec) => (
                  <tr key={rec.id} className={`border-t border-slate-200 ${rec.id === currentId ? "bg-blue-50/50" : "hover:bg-slate-50"}`}>
                    <td className="px-3 py-2 text-[12px] font-medium text-slate-900 whitespace-nowrap">
                      {rec.requisitionNo || `#${rec.id}`}
                      {rec.id === currentId && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium text-blue-900 bg-blue-100 rounded-full">open</span>}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600 whitespace-nowrap">{fmtDate(rec.requisitionDate)}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{rec.requestedBy || "--"}</td>
                    <td className="px-3 py-2 text-[12px] whitespace-nowrap">
                      {rec.priority === "urgent" ? <span className="font-medium text-red-600">Urgent</span> : rec.priority === "normal" ? "Normal" : "--"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{rec.itemCount}</td>
                    <td className="px-3 py-2 text-[12px] text-slate-600">{rec.createdByName || "--"}</td>
                    <td className="px-3 py-2 text-[11px] text-slate-500 whitespace-nowrap">
                      {fmtDateTime(rec.createdAt)}
                      {rec.updatedAt !== rec.createdAt && <div className="text-slate-400">edited {fmtDateTime(rec.updatedAt)}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpen(rec)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                        >
                          <FolderOpen size={12} /> Open
                        </button>
                        <button
                          onClick={() => setPreviewing(rec)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50"
                        >
                          <Eye size={12} /> PDF
                        </button>
                        <button
                          onClick={() => handleDelete(rec)}
                          disabled={deletingId === rec.id}
                          className="flex items-center justify-center w-7 h-7 text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === rec.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {previewing && (
        <PdfPreviewModal
          generate={() => import("../pdf/generatePdf").then((m) => m.generateRequisitionPdf({ ...blankForm(), ...previewing.data }, organization))}
          fileName={`Requisition-${(previewing.requisitionNo || `#${previewing.id}`).replace(/[\\/]/g, "-")}.pdf`}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
};

export default Requisition;
