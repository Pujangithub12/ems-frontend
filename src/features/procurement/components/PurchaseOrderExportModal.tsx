import React, { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import type { PurchaseOrder } from "../../../types";
import { toNumber } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";
import { purchaseOrderTotals } from "../utils/poLineItems";
import { ExportDateRange, fmtExportDateTime, fmtExportDay, isoDay, useExportDateRange } from "./ExportDateRange";

/** The day a PO is filed under: its PO date, or the day it was created when no date was set. */
const dayOf = (o: PurchaseOrder) => (o.poDate ? o.poDate.slice(0, 10) : isoDay(new Date(o.createdAt)));
const currencyOf = (o: PurchaseOrder) => o.currency?.trim() || "NPR";
const num = (v: number | string | null | undefined) => (v == null || v === "" ? "" : toNumber(v));

async function writeWorkbook(orders: PurchaseOrder[], fileName: string) {
  const XLSX = await import("xlsx");

  // Sheet 1 — one row per purchase order with its header details and totals.
  const header = [
    "PO #",
    "PO Date",
    "Project",
    "Vendor",
    "Purchase Type",
    "Currency",
    "Line Items",
    "Sub Total",
    "VAT %",
    "VAT",
    "Grand Total",
    "Payment Terms",
    "Incoterms",
    "Delivery Period",
    "Final Destination",
    "Created By",
    "Created",
  ];
  const rows = orders.map((o) => {
    const t = purchaseOrderTotals(o);
    return [
      o.poNumber || `#${o.id}`,
      fmtExportDay(o.poDate),
      o.project?.name || "",
      o.vendor?.name || "",
      o.purchaseType === "international" ? "International" : "Local",
      currencyOf(o),
      o.items.length,
      t.subTotal,
      num(o.taxPercent),
      t.vat,
      t.grandTotal,
      o.paymentTerms || "",
      o.incoterms || "",
      o.deliveryPeriod || "",
      o.finalDestination || "",
      o.createdBy?.fullName || "",
      fmtExportDateTime(o.createdAt),
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet["!cols"] = [
    { wch: 14 }, { wch: 13 }, { wch: 24 }, { wch: 24 }, { wch: 13 }, { wch: 9 }, { wch: 9 },
    { wch: 15 }, { wch: 7 }, { wch: 13 }, { wch: 15 }, { wch: 28 }, { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 19 },
  ];

  // Sheet 2 — every line item, with its PO's key fields beside it. User-added item columns become their own columns.
  const extraLabels: string[] = [];
  for (const o of orders) for (const c of o.itemColumns ?? []) if (c.label && !extraLabels.includes(c.label)) extraLabels.push(c.label);
  const itemHeader = [
    "PO #", "PO Date", "Project", "Vendor", "Currency", "S.N.", "Item", "Description", "HS Code",
    ...extraLabels, "Qty", "Unit", "Unit Price", "VAT Applies", "Amount",
  ];
  const itemRows: (string | number)[][] = [];
  for (const o of orders) {
    const cols = o.itemColumns ?? [];
    o.items.forEach((i, idx) => {
      const price = i.unitPrice != null && i.unitPrice !== "" ? toNumber(i.unitPrice) : 0;
      const qty = Number(i.quantity) || 0;
      itemRows.push([
        o.poNumber || `#${o.id}`,
        fmtExportDay(o.poDate),
        o.project?.name || "",
        o.vendor?.name || "",
        currencyOf(o),
        idx + 1,
        i.itemName || "",
        i.description || "",
        i.hsnCode || "",
        ...extraLabels.map((label) => {
          const col = cols.find((c) => c.label === label);
          return col ? i.customValues?.[col.key] ?? "" : "";
        }),
        qty,
        i.unit || "",
        num(i.unitPrice),
        i.taxable === false ? "No" : "Yes",
        qty * price,
      ]);
    });
  }
  const itemSheet = XLSX.utils.aoa_to_sheet([itemHeader, ...itemRows]);
  itemSheet["!cols"] = [
    { wch: 14 }, { wch: 13 }, { wch: 24 }, { wch: 24 }, { wch: 9 }, { wch: 5 }, { wch: 30 }, { wch: 30 }, { wch: 11 },
    ...extraLabels.map(() => ({ wch: 16 })),
    { wch: 8 }, { wch: 8 }, { wch: 13 }, { wch: 11 }, { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Purchase Orders");
  XLSX.utils.book_append_sheet(workbook, itemSheet, "Line Items");
  XLSX.writeFile(workbook, fileName);
}

/**
 * "Export" on the Purchase Orders page: pick a date range, project and vendor, see how many POs match,
 * then download them (PO details + every line item) as an .xlsx file.
 */
const PurchaseOrderExportModal: React.FC<{
  orders: PurchaseOrder[];
  /** Pre-selects the project the table is already filtered to. */
  initialProjectId: number | "";
  onClose: () => void;
}> = ({ orders, initialProjectId, onClose }) => {
  const range = useExportDateRange();
  const [projectId, setProjectId] = useState<number | "">(initialProjectId);
  const [vendorId, setVendorId] = useState<number | "">("");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only offer projects / vendors that actually have POs.
  const projectOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of orders) if (o.project) m.set(o.project.id, o.project.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);
  const vendorOptions = useMemo(() => {
    const m = new Map<number, string>();
    for (const o of orders) if (o.vendor) m.set(o.vendor.id, o.vendor.name);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  const selected = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            range.inRange(dayOf(o)) && (!projectId || o.project?.id === projectId) && (!vendorId || o.vendor?.id === vendorId),
        )
        .sort((a, b) => dayOf(a).localeCompare(dayOf(b)) || a.id - b.id),
    [orders, range.from, range.to, projectId, vendorId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const itemTotal = useMemo(() => selected.reduce((n, o) => n + o.items.length, 0), [selected]);
  const count = range.invalid ? 0 : selected.length;

  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await writeWorkbook(selected, `purchase-orders${range.fileSuffix}.xlsx`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to export."));
    } finally {
      setExporting(false);
    }
  };

  const selectCls =
    "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";

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
            <h3 className="font-semibold text-[15px] text-slate-900">Export purchase orders</h3>
            <p className="text-[12px] text-slate-500">Choose which purchase orders go into the Excel file.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <ExportDateRange state={range} hint="Uses the PO date (or the day the PO was created, if no date was set)." />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-slate-600">Project</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">All projects</option>
                {projectOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-[12px] font-medium text-slate-600">Vendor</label>
              <select value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")} className={selectCls}>
                <option value="">All vendors</option>
                {vendorOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="px-4 py-3 rounded-lg bg-slate-50 ring-1 ring-inset ring-slate-200">
            <p className="text-[13px] text-slate-800">
              <span className="font-semibold">{count}</span> purchase order{count === 1 ? "" : "s"} ·{" "}
              <span className="font-semibold">{range.invalid ? 0 : itemTotal}</span> line item{itemTotal === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Two sheets: <b>Purchase Orders</b> (details, terms and totals) and <b>Line Items</b> (every item with qty, price and amount).
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
            disabled={exporting || count === 0}
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

export default PurchaseOrderExportModal;
