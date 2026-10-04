import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Ship, Plus, Search, RefreshCw, Loader2, AlertCircle, X, Pencil, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { ShipmentTrackingRecord } from "../../../types";
import { useShipmentTrackingRecordsQuery, useDeleteShipmentTrackingRecordMutation } from "../hooks/useShipmentTracking";
import { fetchShipmentTrackingPdf } from "../api/shipmentTracking.api";
import { getErrorMessage } from "../../../lib/errors";
import { downloadBlob } from "../../../lib/download";
import ConfirmationModal from "../../../components/ConfirmationModal";
import ShipmentTrackingRecordModal from "./ShipmentTrackingRecordModal";
import ExportMenu from "./ExportMenu";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "--";

type SortKey =
  | "blNumber"
  | "carrierName"
  | "dispatchDate"
  | "eta"
  | "pol"
  | "pod"
  | "containerType"
  | "containerCount"
  | "dispatchedFrom"
  | "documentStatus";

const COLUMNS: { key: SortKey | "remarks"; label: string; sortable?: boolean; align?: "right" }[] = [
  { key: "blNumber", label: "BL Number", sortable: true },
  { key: "carrierName", label: "Carrier Name", sortable: true },
  { key: "dispatchDate", label: "Dispatch Date", sortable: true },
  { key: "eta", label: "ETA", sortable: true },
  { key: "pol", label: "POL", sortable: true },
  { key: "pod", label: "POD", sortable: true },
  { key: "containerType", label: "Type of Container", sortable: true },
  { key: "containerCount", label: "No. of Container", sortable: true, align: "right" },
  { key: "dispatchedFrom", label: "Dispatched From", sortable: true },
  { key: "documentStatus", label: "Document Status", sortable: true },
  { key: "remarks", label: "Remarks" },
];

const sortValue = (r: ShipmentTrackingRecord, key: SortKey): string | number => {
  const v = r[key];
  return v == null ? "" : v;
};

/** Shipment Tracking log — Finance page's second tab. Org-wide, admin/super_admin/finance. */
const ShipmentTrackingTab: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const recordsQuery = useShipmentTrackingRecordsQuery();
  const records = recordsQuery.data ?? [];
  const loading = recordsQuery.isLoading;
  const error = recordsQuery.isError ? getErrorMessage(recordsQuery.error, "Failed to load shipment tracking records.") : null;
  const [refreshing, setRefreshing] = useState(false);

  const deleteMutation = useDeleteShipmentTrackingRecordMutation();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "dispatchDate", dir: "desc" });
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ShipmentTrackingRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShipmentTrackingRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    await recordsQuery.refetch();
    setRefreshing(false);
  };

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = !q
      ? records
      : records.filter((r) =>
          [r.blNumber, r.carrierName, r.pol, r.pod, r.dispatchedFrom, r.documentStatus, r.remarks]
            .some((v) => (v || "").toLowerCase().includes(q)),
        );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return cmp !== 0 ? cmp * dir : b.id - a.id;
    });
  }, [records, search, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  /** Exports exactly what's currently visible (filtered/sorted) — a client-side .xlsx build,
   * same XLSX.writeFile pattern used elsewhere in this app. */
  const exportExcel = () => {
    const header = COLUMNS.map((c) => c.label);
    const data = filteredRecords.map((r) => [
      r.blNumber || "", r.carrierName || "", formatDate(r.dispatchDate), formatDate(r.eta), r.pol || "", r.pod || "",
      r.containerType || "", r.containerCount ?? "", r.dispatchedFrom || "", r.documentStatus || "", r.remarks || "",
    ]);
    const sheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Shipment Tracking");
    XLSX.writeFile(workbook, "shipment-tracking.xlsx");
  };

  /** The PDF (rendered server-side for a clean report layout) covers the full org-wide log,
   * not just the current search/sort — same scope as the Excel export would need a round trip
   * for anyway, so it's simplest to keep the PDF as the one authoritative "export everything". */
  const exportPdf = async () => {
    const blob = await fetchShipmentTrackingPdf();
    downloadBlob(blob, "shipment-tracking.pdf");
  };

  const openCreateForm = () => {
    setEditingRecord(null);
    setShowForm(true);
  };

  const openEditForm = (record: ShipmentTrackingRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  const handleSaved = () => {
    closeForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete record."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading shipment tracking records…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="flex items-center justify-center w-12 h-12 mb-1 rounded-full bg-gradient-to-br from-red-50 to-red-100 ring-1 ring-red-100">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <p className="text-[13px] text-slate-600">{error}</p>
        <button onClick={refresh} className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-w-0 gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search BL number, carrier, POL/POD..."
            className="pl-8 pr-3 py-2 w-72 text-[12px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <ExportMenu onExportExcel={exportExcel} onExportPdf={exportPdf} />
          {isAdmin && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-[12px] font-medium hover:bg-blue-800 transition-colors shadow-sm"
            >
              <Plus size={14} /> Add Record
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-sm border-slate-200">
        {filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
              <Ship className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No shipment tracking records{search ? " match your search" : " yet"}</h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {isAdmin && !search ? "Add a record to start tracking shipments in transit." : "Try adjusting your search."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f3f6fb]">
                  {COLUMNS.map((c) => {
                    const active = c.sortable && sort.key === c.key;
                    return (
                      <th
                        key={c.key}
                        onClick={c.sortable ? () => toggleSort(c.key as SortKey) : undefined}
                        className={`px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 whitespace-nowrap ${
                          c.align === "right" ? "text-right" : ""
                        } ${c.sortable ? "cursor-pointer select-none" : ""}`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {c.label}
                          {c.sortable &&
                            (active ? (
                              sort.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                            ) : (
                              <ChevronsUpDown size={11} className="text-slate-400" />
                            ))}
                        </span>
                      </th>
                    );
                  })}
                  {isAdmin && <th className="px-2.5 py-3 text-[11.5px] font-semibold text-slate-700 border border-slate-200 text-right whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const cell = "px-2.5 py-3 text-[12px] text-slate-800 border border-slate-200";
                  return (
                  <tr
                    key={r.id}
                    onClick={() => isAdmin && openEditForm(r)}
                    className={`hover:bg-blue-50/60 bg-white ${isAdmin ? "cursor-pointer" : ""}`}
                  >
                    <td className={`${cell} font-semibold whitespace-nowrap`}>{r.blNumber || "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.carrierName || "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{formatDate(r.dispatchDate)}</td>
                    <td className={`${cell} whitespace-nowrap`}>{formatDate(r.eta)}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.pol || "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.pod || "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.containerType || "--"}</td>
                    <td className={`${cell} text-right whitespace-nowrap`}>{r.containerCount ?? "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.dispatchedFrom || "--"}</td>
                    <td className={`${cell} whitespace-nowrap`}>{r.documentStatus || "--"}</td>
                    <td className={`${cell} max-w-[200px] truncate`} title={r.remarks || undefined}>
                      {r.remarks || "--"}
                    </td>
                    {isAdmin && (
                      <td className={cell} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditForm(r)}
                            title="Edit"
                            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            title="Delete"
                            className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && <ShipmentTrackingRecordModal editingRecord={editingRecord} onClose={closeForm} onSaved={handleSaved} />}

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Record"
        message={`Delete the record for "${deleteTarget?.blNumber || "this shipment"}"? This cannot be undone.`}
      />
    </div>
  );
};

export default ShipmentTrackingTab;
