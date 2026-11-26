import React, { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import type { RequisitionRecord, RequisitionStatus } from "../api/requisition.api";
import { getErrorMessage } from "../../../lib/errors";
import { ExportDateRange, fmtExportDateTime as fmtDateTime, fmtExportDay as fmtDay, isoDay, useExportDateRange } from "./ExportDateRange";

const STATUS_LABEL: Record<RequisitionStatus, string> = { in_process: "In Process", approved: "Approved", declined: "Declined" };
const STATUS_ORDER: RequisitionStatus[] = ["in_process", "approved", "declined"];
/** Same order/titles as the Approval section of the requisition form. */
const APPROVAL_TITLES = ["Prepared / Requested By", "Procurement Officer", "Final Approver"];

const statusOf = (r: RequisitionRecord): RequisitionStatus => (STATUS_LABEL[r.status] ? r.status : "in_process");

/** The day a requisition is filed under: its requisition date, or the day it was saved when that's blank. */
const dayOf = (r: RequisitionRecord) => (r.requisitionDate ? r.requisitionDate.slice(0, 10) : isoDay(new Date(r.createdAt)));

const hasContent = (i: RequisitionRecord["data"]["items"][number]) =>
  [i.description, i.unit, i.qty, i.comment, ...Object.values(i.custom ?? {})].some((v) => (v ?? "").trim() !== "");

async function writeWorkbook(records: RequisitionRecord[], fileName: string) {
  const XLSX = await import("xlsx");

  // Sheet 1 — every field of the requisition form, one row per requisition.
  const header = [
    "Requisition No.",
    "Date",
    "Requested By",
    "Project / Location",
    "Priority",
    "Status",
    "Items",
    "Reason for Requisition",
    "Preferred Supplier",
    "Suggested Brand",
    "Delivery Location",
    "Special Instructions",
    ...APPROVAL_TITLES.flatMap((t) => [`${t} — Name`, `${t} — Date`]),
    "Created By",
    "Saved",
    "Last Edited",
  ];
  const rows = records.map((r) => {
    const d = r.data;
    const approvals = APPROVAL_TITLES.flatMap((_, i) => [d.approvals?.[i]?.name ?? "", fmtDay(d.approvals?.[i]?.date ?? "")]);
    return [
      r.requisitionNo || `#${r.id}`,
      fmtDay(r.requisitionDate),
      r.requestedBy || "",
      d.projectLocation || "",
      r.priority === "urgent" ? "Urgent" : r.priority === "normal" ? "Normal" : "",
      STATUS_LABEL[statusOf(r)],
      r.itemCount,
      d.reason || "",
      d.preferredSupplier || "",
      d.suggestedBrand || "",
      d.deliveryLocation || "",
      d.specialInstructions || "",
      ...approvals,
      r.createdByName || "",
      fmtDateTime(r.createdAt),
      r.updatedAt !== r.createdAt ? fmtDateTime(r.updatedAt) : "",
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [
    { wch: 16 }, { wch: 13 }, { wch: 20 }, { wch: 24 }, { wch: 9 }, { wch: 11 }, { wch: 6 },
    { wch: 40 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 30 },
    ...APPROVAL_TITLES.flatMap(() => [{ wch: 22 }, { wch: 13 }]),
    { wch: 20 }, { wch: 19 }, { wch: 19 },
  ];

  // Sheet 2 — the Item Requisition Details: every line item, with its requisition's key fields beside it.
  // Columns the user added to an item table become their own columns here (union across all requisitions).
  const extraLabels: string[] = [];
  for (const r of records) for (const c of r.data.itemColumns ?? []) if (c.label && !extraLabels.includes(c.label)) extraLabels.push(c.label);
  const itemHeader = ["Requisition No.", "Date", "Requested By", "Project / Location", "Status", "S.N.", "Item Description", "Unit", "Qty.", ...extraLabels, "Comment"];
  const itemRows: (string | number)[][] = [];
  for (const r of records) {
    const cols = r.data.itemColumns ?? [];
    (r.data.items ?? []).filter(hasContent).forEach((i, idx) => {
      const extras = extraLabels.map((label) => {
        const col = cols.find((c) => c.label === label);
        return col ? i.custom?.[col.key] ?? "" : "";
      });
      itemRows.push([
        r.requisitionNo || `#${r.id}`,
        fmtDay(r.requisitionDate),
        r.requestedBy || "",
        r.data.projectLocation || "",
        STATUS_LABEL[statusOf(r)],
        idx + 1,
        i.description || "",
        i.unit || "",
        i.qty || "",
        ...extras,
        i.comment || "",
      ]);
    });
  }
  const itemSheet = XLSX.utils.aoa_to_sheet([itemHeader, ...itemRows]);
  itemSheet["!cols"] = [
    { wch: 16 }, { wch: 13 }, { wch: 20 }, { wch: 24 }, { wch: 11 }, { wch: 5 }, { wch: 40 }, { wch: 8 }, { wch: 8 },
    ...extraLabels.map(() => ({ wch: 16 })),
    { wch: 30 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Requisitions");
  XLSX.utils.book_append_sheet(workbook, itemSheet, "Item Details");
  XLSX.writeFile(workbook, fileName);
}

/**
 * "Export" on the Requisition page: pick a date range and statuses, see how many requisitions match,
 * then download them (full form details + every line item) as an .xlsx file.
 */
const RequisitionExportModal: React.FC<{
  rows: RequisitionRecord[];
  /** Pre-ticks only this status when the table is already filtered to it. */
  initialStatus: RequisitionStatus | "";
  onClose: () => void;
}> = ({ rows, initialStatus, onClose }) => {
  const range = useExportDateRange();
  const [statuses, setStatuses] = useState<Set<RequisitionStatus>>(() => new Set(initialStatus ? [initialStatus] : STATUS_ORDER));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      rows
        .filter((r) => {
          const day = dayOf(r);
          return statuses.has(statusOf(r)) && range.inRange(day);
        })
        .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.id - b.id),
    [rows, statuses, range.from, range.to],
  );
  const itemTotal = useMemo(() => selected.reduce((n, r) => n + (r.data.items ?? []).filter(hasContent).length, 0), [selected]);
  const rangeInvalid = range.invalid;

  const toggleStatus = (s: RequisitionStatus) =>
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await writeWorkbook(selected, `requisitions${range.fileSuffix}.xlsx`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to export."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex flex-col w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-2xl border-slate-200/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <span className="flex items-center justify-center flex-shrink-0 rounded-lg w-9 h-9 bg-emerald-50 ring-1 ring-emerald-100">
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] text-slate-900">Export requisitions</h3>
            <p className="text-[12px] text-slate-500">Choose which requisitions go into the Excel file.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <ExportDateRange state={range} hint="Uses the requisition date (or the day it was saved, if no date was entered)." />

          <div>
            <label className="block mb-2 text-[12px] font-medium text-slate-600">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map((s) => (
                <label
                  key={s}
                  className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] border rounded-lg cursor-pointer transition-colors ${
                    statuses.has(s) ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={statuses.has(s)}
                    onChange={() => toggleStatus(s)}
                    className="w-3.5 h-3.5 text-blue-900 rounded border-slate-300 focus:ring-blue-900"
                  />
                  {STATUS_LABEL[s]}
                </label>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200">
            <p className="text-[13px] text-slate-800">
              <span className="font-semibold">{rangeInvalid ? 0 : selected.length}</span> requisition{selected.length === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold">{rangeInvalid ? 0 : itemTotal}</span> item{itemTotal === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Two sheets: <b>Requisitions</b> (all form details incl. reason, procurement details and approvals) and{" "}
              <b>Item Details</b> (every line item).
            </p>
          </div>

          {error && <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={doExport}
            disabled={exporting || rangeInvalid || selected.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white rounded-lg shadow-sm bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequisitionExportModal;
