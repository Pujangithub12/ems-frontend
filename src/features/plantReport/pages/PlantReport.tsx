import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  Table as TableIcon,
  LineChart as LineChartIcon,
  BarChart3,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { useAuth } from "../../../context/AuthProvider";
import { useProjects } from "../../projects/hooks/useProjects";
import { getErrorMessage } from "../../../lib/errors";
import ErrorBanner from "../../../components/ErrorBanner";
import ConfirmationModal from "../../../components/ConfirmationModal";
import {
  usePlantReportTables,
  usePlantReportTableDetail,
  useCreatePlantReportTable,
  useUpdatePlantReportTable,
  useDeletePlantReportTable,
  useCreatePlantReportColumn,
  useUpdatePlantReportColumn,
  useDeletePlantReportColumn,
  useCreatePlantReportRow,
  useUpdatePlantReportRow,
  useDeletePlantReportRow,
  useImportPlantReportSheet,
} from "../hooks/usePlantReport";
import type {
  PlantReportTable,
  PlantReportColumn,
  PlantReportColumnDataType,
  PlantReportRow,
  PlantReportCellValue,
} from "../api/plantReport.api";

const inputCls =
  "w-full px-3 py-2 text-[13px] bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-400 transition-colors";

const COLUMN_DATA_TYPES: { value: PlantReportColumnDataType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
];

const CHART_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

// ---- Flexible date parsing — accept dates typed/pasted in nearly any common
// format and normalize to "YYYY-MM-DD" for storage. ----

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function normalizeYear(y: number): number {
  if (y < 100) return y < 70 ? 2000 + y : 1900 + y;
  return y;
}

function toIsoIfValid(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parses a date typed/pasted in nearly any common format — "18-Sep-2026",
 * "18/09/2026", "2026-09-18", "18 Sep 26", "September 18, 2026" — into a
 * "YYYY-MM-DD" string, or null if it can't be understood. Ambiguous numeric
 * day/month pairs are read as DD/MM (day-first), matching this org's paper
 * forms and Excel exports rather than the US MM/DD convention. */
function parseFlexibleDate(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return toIsoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const parts = raw.replace(/,/g, " ").split(/[\s\-/.]+/).filter(Boolean);
  if (parts.length === 3) {
    const monthIdx = parts.findIndex((p) => /^[a-zA-Z]/.test(p) && MONTH_NAMES.includes(p.slice(0, 3).toLowerCase()));
    if (monthIdx !== -1) {
      const month = MONTH_NAMES.indexOf(parts[monthIdx].slice(0, 3).toLowerCase()) + 1;
      const rest = parts.filter((_, i) => i !== monthIdx).map(Number);
      if (rest.length === 2 && rest.every((n) => Number.isFinite(n))) {
        const [a, b] = rest;
        const day = a > 31 ? b : a;
        const year = normalizeYear(a > 31 ? a : b);
        return toIsoIfValid(year, month, day);
      }
    }
  }

  const numeric = raw.match(/^(\d{1,4})[\-/.](\d{1,2})[\-/.](\d{1,4})$/);
  if (numeric) {
    const [, p1, p2, p3] = numeric;
    if (p1.length === 4) return toIsoIfValid(Number(p1), Number(p2), Number(p3));
    return toIsoIfValid(normalizeYear(Number(p3)), Number(p2), Number(p1));
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) {
    return toIsoIfValid(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
  }

  return null;
}

/** Converts an Excel date *serial number* (days since the 1899-12-30 epoch —
 * Excel's famous fake-1900-leap-year bug baked in) into a "YYYY-MM-DD"
 * string, using pure UTC arithmetic. Deliberately not XLSX's own `cellDates`
 * conversion: tested against a real exported report, that option round-trips
 * through the *local machine's* timezone and landed on the wrong calendar
 * day (in Nepal, UTC+5:45) — this direct math is timezone-independent. */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
  const d = new Date(EXCEL_EPOCH_UTC_MS + Math.round(serial) * 86400000);
  if (Number.isNaN(d.getTime())) return null;
  return toIsoIfValid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Converts an arbitrary parsed-spreadsheet cell value (a JS `Date`, a raw
 * Excel date serial number, or free text) into a "YYYY-MM-DD" string, or
 * null. Without this, a date cell round-trips as a bare serial number, which
 * `parseFlexibleDate` can't make sense of as a string — the column ends up
 * empty (the backend rejects anything that isn't already "YYYY-MM-DD") or
 * shows the serial number mashed together with other text. */
function toIsoDateValue(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return toIsoIfValid(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return excelSerialToIso(raw);
  return parseFlexibleDate(String(raw));
}

/** Rounds away Excel/XLSX floating-point noise from arithmetic (e.g.
 * 92.00000000000001 or 0.29999999999999993) without touching legitimate
 * decimals — Excel's numbers are IEEE-754 doubles same as JS, so this noise
 * shows up on plain numeric columns too, not just computed ones. */
function cleanExcelNumber(v: unknown): unknown {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 1e9) / 1e9;
  return v;
}

/** Formats a stored "YYYY-MM-DD" value for display, e.g. "18 Sep 2026". */
function formatDateDisplay(value: string): string {
  const parsed = parseFlexibleDate(value);
  const d = new Date(`${parsed ?? value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

// ---- Add / rename table modal ----

const TableNameModal: React.FC<{
  title: string;
  initialName?: string;
  confirmLabel: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}> = ({ title, initialName = "", confirmLabel, onSave, onClose }) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(name.trim());
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">{title}</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <input
            autoFocus
            className={inputCls}
            placeholder="Tab name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          {error && <p className="text-[11.5px] text-red-600">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center w-full gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Add column modal ----

const AddColumnModal: React.FC<{ tableId: number; onClose: () => void }> = ({ tableId, onClose }) => {
  const createMutation = useCreatePlantReportColumn();
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<PlantReportColumnDataType>("text");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Column name is required.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        tableId,
        payload: { name: name.trim(), dataType, target: target.trim() ? Number(target) : null },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add column."));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div className="font-semibold text-[14px] text-slate-900">Add Column</div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <input autoFocus className={inputCls} placeholder="Column name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className={inputCls} value={dataType} onChange={(e) => setDataType(e.target.value as PlantReportColumnDataType)}>
            {COLUMN_DATA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {dataType === "number" && (
            <input
              className={inputCls}
              placeholder="Expected target (optional)"
              type="number"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
          {error && <p className="text-[11.5px] text-red-600">{error}</p>}
          <button
            onClick={handleSave}
            disabled={createMutation.isPending}
            className="flex items-center justify-center w-full gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add Column
          </button>
        </div>
      </div>
    </div>
  );
};

// ---- Edit column modal (rename / change type / delete) ----

const EditColumnModal: React.FC<{
  tableId: number;
  column: PlantReportColumn;
  isLastDateColumnOfDefaultTable: boolean;
  onClose: () => void;
}> = ({ tableId, column, isLastDateColumnOfDefaultTable, onClose }) => {
  const updateMutation = useUpdatePlantReportColumn();
  const deleteMutation = useDeletePlantReportColumn();
  const [name, setName] = useState(column.name);
  const [dataType, setDataType] = useState<PlantReportColumnDataType>(column.dataType);
  const [target, setTarget] = useState(column.target != null ? String(column.target) : "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Column name is required.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: column.id,
        tableId,
        payload: { name: name.trim(), dataType, target: target.trim() ? Number(target) : null },
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save column."));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <div className="w-full max-w-sm overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <div className="font-semibold text-[14px] text-slate-900">Edit Column</div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            <select
              className={inputCls}
              value={dataType}
              onChange={(e) => setDataType(e.target.value as PlantReportColumnDataType)}
              disabled={isLastDateColumnOfDefaultTable}
            >
              {COLUMN_DATA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {dataType === "number" && (
              <input
                className={inputCls}
                placeholder="Expected target (optional)"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            )}
            {isLastDateColumnOfDefaultTable && (
              <p className="text-[11.5px] text-slate-400">Progress Tracker must keep at least one Date column.</p>
            )}
            {error && <p className="text-[11.5px] text-red-600">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={isLastDateColumnOfDefaultTable}
                title={isLastDateColumnOfDefaultTable ? "Progress Tracker must keep at least one Date column" : undefined}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center justify-center flex-1 gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync({ id: column.id, tableId });
            setConfirmDelete(false);
            onClose();
          } catch (err) {
            setConfirmDelete(false);
            setError(getErrorMessage(err, "Failed to delete column."));
          }
        }}
        title="Delete Column"
        message={`Delete "${column.name}"? Values already entered for it will no longer be shown.`}
        confirmText="Delete"
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};

// ---- One editable cell, switching input by the column's data type ----

const Cell: React.FC<{
  column: PlantReportColumn;
  value: PlantReportCellValue;
  onCommit: (value: PlantReportCellValue) => void;
  editable: boolean;
}> = ({ column, value, onCommit, editable }) => {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(value == null ? "" : String(value));
  }, [value, focused]);

  if (!editable) {
    const display =
      column.dataType === "boolean"
        ? value
          ? "Yes"
          : "No"
        : column.dataType === "date"
          ? value == null
            ? ""
            : formatDateDisplay(String(value))
          : value == null
            ? ""
            : String(value);
    return <span className="block px-1.5 py-1 text-[12.5px] text-slate-700 truncate">{display || "—"}</span>;
  }

  if (column.dataType === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onCommit(e.target.checked)}
        className="w-4 h-4 rounded accent-blue-800"
      />
    );
  }

  if (column.dataType === "date") {
    const shownValue = focused ? draft : value == null ? "" : formatDateDisplay(String(value));
    const isInvalidDraft = focused && draft.trim() !== "" && parseFlexibleDate(draft) === null;
    return (
      <input
        type="text"
        value={shownValue}
        placeholder="e.g. 18-Sep-2026"
        onFocus={() => {
          setFocused(true);
          setDraft(value == null ? "" : String(value));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const parsed = draft.trim() === "" ? null : parseFlexibleDate(draft);
          onCommit(parsed);
        }}
        title={isInvalidDraft ? "Couldn't understand that date — try formats like 18-Sep-2026, 18/09/2026, or 2026-09-18" : undefined}
        className={`w-full px-1.5 py-1 text-[12.5px] bg-transparent outline-none focus:bg-white rounded ${
          isInvalidDraft ? "text-red-600" : ""
        }`}
      />
    );
  }

  return (
    <input
      type={column.dataType === "number" ? "number" : "text"}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft === "" ? null : column.dataType === "number" ? Number(draft) : draft)}
      className="w-full px-1.5 py-1 text-[12.5px] bg-transparent outline-none focus:bg-white rounded"
    />
  );
};

// ---- Spreadsheet view for one table ----

// ---- Upload Sheet — parse a CSV/Excel file client-side, then bulk-import it ----

/** Reads a CSV or Excel file's first sheet into a header row + row objects
 * keyed by header, plus which headers Excel itself formatted as dates.
 *
 * This reads cells directly off the sheet (via `!ref`/`encode_cell`) rather
 * than through XLSX's `sheet_to_json`, for two reasons found by testing
 * against a real exported report:
 *  - Row keys must be exactly the *trimmed* header text (matching `headers`
 *    and, later, a table's existing column names) — a header cell with
 *    stray whitespace ("Date ") would otherwise make row keys diverge from
 *    the column name and break name-based matching on a repeat upload.
 *  - Detecting "this numeric column is actually a date" needs each cell's
 *    Excel number-format code (`.z`, via `cellNF: true`) checked with
 *    `XLSX.SSF.is_date` — inferring it from the bare numeric value alone
 *    can't tell a date serial from a plain number. XLSX's own `cellDates`
 *    option looked like the built-in way to do this, but it round-trips
 *    dates through the *local machine's* timezone and was verified (against
 *    this exact file, in Nepal's UTC+5:45) to land on the wrong calendar
 *    day; converting the serial ourselves with pure UTC math, elsewhere in
 *    this file, does not have that problem.
 *  - For plain numeric cells, Excel's own formatted display text (`.w`) is
 *    used instead of the raw stored double — e.g. Excel shows "853" for a
 *    computed value stored as 852.830188679245. Importing the raw double
 *    surfaced as "random" extra decimals the user never saw in Excel.
 */
async function parseSheetFile(
  file: File,
): Promise<{ headers: string[]; rows: Record<string, unknown>[]; dateColumnNames: Set<string> }> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const data = isCsv ? await file.text() : await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: isCsv ? "string" : "array", cellNF: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet["!ref"]) return { headers: [], rows: [], dateColumnNames: new Set() };

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  type SheetCell = { t?: string; v?: unknown; w?: string; z?: string };
  const cellAt = (r: number, c: number): SheetCell | undefined => sheet[XLSX.utils.encode_cell({ r, c })];

  const headerEntries: { name: string; index: number }[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = cellAt(range.s.r, c);
    const name = String(cell?.v ?? cell?.w ?? "").trim();
    if (name) headerEntries.push({ name, index: c });
  }
  const headers = headerEntries.map((e) => e.name);

  const dateColumnNames = new Set<string>();
  for (const { name, index } of headerEntries) {
    let sampled = 0;
    let dateLike = 0;
    for (let r = range.s.r + 1; r <= range.e.r && sampled < 50; r++) {
      const cell = cellAt(r, index);
      if (!cell || cell.v == null || cell.v === "") continue;
      sampled++;
      if (cell.t === "n" && XLSX.SSF.is_date(cell.z || "")) dateLike++;
    }
    if (sampled > 0 && dateLike === sampled) dateColumnNames.add(name);
  }

  const rows: Record<string, unknown>[] = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const row: Record<string, unknown> = {};
    let hasValue = false;
    for (const { name, index } of headerEntries) {
      const cell = cellAt(r, index);
      if (!cell || cell.v == null || cell.v === "") {
        row[name] = null;
        continue;
      }
      hasValue = true;
      if (dateColumnNames.has(name) && cell.t === "n") {
        row[name] = excelSerialToIso(cell.v as number);
      } else if (cell.t === "n") {
        const displayed = cell.w != null ? Number(String(cell.w).replace(/[^0-9.-]/g, "")) : NaN;
        row[name] = Number.isFinite(displayed) ? displayed : cleanExcelNumber(cell.v);
      } else {
        row[name] = cell.v;
      }
    }
    if (hasValue) rows.push(row);
  }

  return { headers, rows, dateColumnNames };
}

/** Coerces one parsed spreadsheet cell value to match an *existing* column's
 * data type — import never creates columns, so every value that survives
 * gets forced into the shape its target column already declared, the same
 * way a manually-typed cell edit would. */
function coerceToColumnType(raw: unknown, dataType: PlantReportColumnDataType): PlantReportCellValue {
  if (raw == null || String(raw).trim() === "") return null;
  switch (dataType) {
    case "date":
      return toIsoDateValue(raw);
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return typeof raw === "boolean" ? raw : /^(true|yes|1)$/i.test(String(raw).trim());
    case "text":
    default:
      return String(raw).trim();
  }
}

type PendingImport = {
  fileName: string;
  /** Columns from the file that matched an existing column by name — these
   * are the only ones that will actually be imported. */
  matchedColumns: { id: number; name: string; dataType: PlantReportColumnDataType }[];
  /** Header text from the file with no matching existing column — shown as
   * a warning; their data is simply not imported. */
  unmatchedHeaders: string[];
  /** Keyed by column id (string), matching PlantReportRow.values. */
  rows: Record<string, PlantReportCellValue>[];
};

const PREVIEW_ROW_LIMIT = 15;

/** Shown after a file is parsed, before anything is actually uploaded — lets
 * the user see exactly which existing columns will be filled (and which of
 * the file's headers have no match and will be skipped) and back out.
 * Import never creates columns — add them manually first if a header should
 * have one. */
const ImportPreviewModal: React.FC<{
  pending: PendingImport;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
}> = ({ pending, onConfirm, onCancel, isSubmitting, error }) => {
  const previewRows = pending.rows.slice(0, PREVIEW_ROW_LIMIT);
  const nothingToImport = pending.matchedColumns.length === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <div>
            <div className="font-semibold text-[14px] text-slate-900">Preview Import</div>
            <div className="text-[11.5px] text-slate-500 mt-0.5">{pending.fileName}</div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-[12.5px] text-slate-600">
            {pending.rows.length} row{pending.rows.length === 1 ? "" : "s"} · {pending.matchedColumns.length} matched column
            {pending.matchedColumns.length === 1 ? "" : "s"}
            {pending.rows.length > PREVIEW_ROW_LIMIT ? ` — showing first ${PREVIEW_ROW_LIMIT}` : ""}
          </p>

          {nothingToImport ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center border border-dashed rounded-lg border-slate-200">
              <p className="text-[12.5px] font-medium text-slate-600">None of this file's columns match a column in this table.</p>
              <p className="text-[12px] text-slate-400">Add matching columns first, or check the header names in your file.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-lg border-slate-200 max-h-80">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0">
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {pending.matchedColumns.map((col) => (
                      <th key={col.id} className="py-2 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap border-r border-slate-100 last:border-r-0">
                        <div className="flex items-center gap-1.5 normal-case">
                          <span className="font-semibold text-slate-700">{col.name}</span>
                          <span className="text-[9px] font-semibold text-slate-400">({col.dataType})</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      {pending.matchedColumns.map((col) => (
                        <td key={col.id} className="px-3 py-1.5 text-[12px] text-slate-600 whitespace-nowrap border-r border-slate-50 last:border-r-0">
                          {row[String(col.id)] == null ? <span className="text-slate-300">—</span> : String(row[String(col.id)])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pending.unmatchedHeaders.length > 0 && (
            <p className="mt-2 text-[11.5px] text-amber-600">
              No matching column for: {pending.unmatchedHeaders.join(", ")} — that data will be skipped. Add columns with these exact
              names first if you want them imported.
            </p>
          )}
          {error && <p className="mt-2 text-[11.5px] text-red-600">{error}</p>}

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting || nothingToImport}
              title={nothingToImport ? "No matched columns to import" : undefined}
              className="flex items-center justify-center flex-1 gap-1.5 px-3 py-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Confirm Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Shown when "Upload Sheet" is clicked, before the OS file picker opens —
 * explains what the file needs to look like so an upload isn't a guessing game. */
const FileFormatInfoModal: React.FC<{
  inputId: string;
  onFileChosen: (file: File | undefined) => void;
  onClose: () => void;
}> = ({ inputId, onFileChosen, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div className="w-full max-w-md overflow-hidden bg-white border rounded-xl shadow-2xl border-slate-200/70">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/60">
        <div className="font-semibold text-[14px] text-slate-900">File Format</div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-[12.5px] text-slate-600">Your file should look like this:</p>
        <div className="overflow-x-auto border rounded-lg border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border-r border-slate-200 last:border-r-0">Date</th>
                <th className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 border-r border-slate-200 last:border-r-0">Quantity</th>
                <th className="px-3 py-1.5 text-[11px] font-semibold text-slate-600">Remarks</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-500">
              <tr className="border-t border-slate-100">
                <td className="px-3 py-1.5 border-r border-slate-100 last:border-r-0">2026-01-15</td>
                <td className="px-3 py-1.5 border-r border-slate-100 last:border-r-0">120</td>
                <td className="px-3 py-1.5">On track</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-3 py-1.5 border-r border-slate-100 last:border-r-0">2026-01-16</td>
                <td className="px-3 py-1.5 border-r border-slate-100 last:border-r-0">95</td>
                <td className="px-3 py-1.5">Delayed</td>
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="text-[12px] text-slate-500 space-y-1.5 list-disc pl-4">
          <li>.csv, .xlsx or .xls</li>
          <li>The first row must be column headers — one header per column, no blank/merged header cells</li>
          <li>Every row after that is one entry</li>
          <li>A header must exactly match an existing column's name (case-insensitive) to be imported — this never creates new columns, so add a matching column first if one doesn't exist yet</li>
          <li>Any header with no matching column is skipped — you'll see which ones in the preview</li>
          <li>You'll see a preview before anything is actually uploaded</li>
        </ul>
        <label
          htmlFor={inputId}
          className="flex items-center justify-center w-full gap-1.5 px-3 py-2 mt-2 text-[12.5px] font-medium text-white bg-blue-900 rounded-lg shadow-sm cursor-pointer hover:bg-blue-800"
        >
          <Upload size={14} />
          Choose File
          <input
            id={inputId}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              onFileChosen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  </div>
);

const UploadSheetButton: React.FC<{ tableId: number; existingColumns: PlantReportColumn[] }> = ({ tableId, existingColumns }) => {
  const importMutation = useImportPlantReportSheet();
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [formatInfoOpen, setFormatInfoOpen] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const inputId = `plant-report-upload-${tableId}`;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setFormatInfoOpen(false);
    try {
      const { headers, rows } = await parseSheetFile(file);
      if (headers.length === 0) {
        setMessage({ kind: "error", text: "Couldn't find a header row in that file." });
        return;
      }

      const matchedColumns: { id: number; name: string; dataType: PlantReportColumnDataType }[] = [];
      const unmatchedHeaders: string[] = [];
      const headerToColumn = new Map<string, PlantReportColumn>();
      for (const h of headers) {
        const existing = existingColumns.find((c) => c.name.trim().toLowerCase() === h.trim().toLowerCase());
        if (existing) {
          matchedColumns.push({ id: existing.id, name: existing.name, dataType: existing.dataType });
          headerToColumn.set(h, existing);
        } else {
          unmatchedHeaders.push(h);
        }
      }

      const normalizedRows = rows.map((row) => {
        const out: Record<string, PlantReportCellValue> = {};
        for (const [header, column] of headerToColumn) {
          out[String(column.id)] = coerceToColumnType(row[header], column.dataType);
        }
        return out;
      });

      setPreviewError(null);
      setPending({ fileName: file.name, matchedColumns, unmatchedHeaders, rows: normalizedRows });
    } catch (err) {
      setMessage({ kind: "error", text: getErrorMessage(err, "Failed to read that file.") });
    }
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setPreviewError(null);
    try {
      const result = await importMutation.mutateAsync({ tableId, payload: { rows: pending.rows } });
      setPending(null);
      setMessage({
        kind: "success",
        text: `Imported ${result.rowsCreated} row${result.rowsCreated === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      setPreviewError(getErrorMessage(err, "Failed to import that file."));
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        onClick={() => setFormatInfoOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg cursor-pointer text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors"
      >
        <Upload size={13} />
        Upload Sheet
      </button>
      {message && (
        <p className={`text-[11.5px] ${message.kind === "success" ? "text-emerald-600" : "text-red-600"}`}>{message.text}</p>
      )}

      {formatInfoOpen && <FileFormatInfoModal inputId={inputId} onFileChosen={handleFile} onClose={() => setFormatInfoOpen(false)} />}

      {pending && (
        <ImportPreviewModal
          pending={pending}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
          isSubmitting={importMutation.isPending}
          error={previewError}
        />
      )}
    </div>
  );
};

// ---- Export — download the current table as an .xlsx, one column per PlantReportColumn ----

const formatCellForExport = (value: PlantReportCellValue, dataType: PlantReportColumnDataType): string | number | boolean | null => {
  if (value == null) return null;
  if (dataType === "boolean") return value ? "Yes" : "No";
  return value;
};

const exportTableToXlsx = (tableName: string, columns: PlantReportColumn[], rows: PlantReportRow[]) => {
  const aoa: (string | number | boolean | null)[][] = [
    columns.map((c) => c.name),
    ...rows.map((row) => columns.map((c) => formatCellForExport(row.values[String(c.id)] ?? null, c.dataType))),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, tableName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(workbook, `${tableName || "table"}.xlsx`);
};

const ExportSheetButton: React.FC<{ tableName: string; columns: PlantReportColumn[]; rows: PlantReportRow[] }> = ({
  tableName,
  columns,
  rows,
}) => (
  <button
    onClick={() => exportTableToXlsx(tableName, columns, rows)}
    disabled={columns.length === 0}
    title={columns.length === 0 ? "Add a column before exporting" : "Download as .xlsx"}
    className="flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <Download size={13} />
    Export
  </button>
);

type Granularity = "daily" | "weekly" | "monthly";

/** Monday-start week for "weekly"; calendar month for "monthly". */
function getPeriodKey(date: Date, granularity: Exclude<Granularity, "daily">): { key: string; label: string } {
  if (granularity === "monthly") {
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    return { key, label };
  }
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  const key = d.toISOString().slice(0, 10);
  const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  return { key, label };
}

type AggregatedRow = { key: string; label: string; count: number; sums: Record<number, number> };

/** Sums every Number column's values, grouped by the chosen Date column's
 * week or month — computed fresh from the loaded rows, never stored. */
function aggregateRows(
  rows: PlantReportRow[],
  dateColumn: PlantReportColumn,
  numberColumns: PlantReportColumn[],
  granularity: Exclude<Granularity, "daily">,
): AggregatedRow[] {
  const buckets = new Map<string, AggregatedRow>();
  for (const row of rows) {
    const raw = row.values[String(dateColumn.id)];
    if (raw == null || raw === "") continue;
    const date = new Date(String(raw));
    if (Number.isNaN(date.getTime())) continue;
    const { key, label } = getPeriodKey(date, granularity);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, label, count: 0, sums: {} };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    for (const col of numberColumns) {
      const v = row.values[String(col.id)];
      if (typeof v === "number") bucket.sums[col.id] = (bucket.sums[col.id] ?? 0) + v;
    }
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Read-only rollup shown for the Weekly/Monthly views — one row per period,
 * with each Number column summed across that period's entries. */
const AggregatedTable: React.FC<{ granularity: Granularity; rows: AggregatedRow[]; numberColumns: PlantReportColumn[] }> = ({
  granularity,
  rows,
  numberColumns,
}) => (
  <div className="overflow-x-auto bg-white border rounded-xl shadow-sm border-slate-200">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/60">
          <th className="py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {granularity === "monthly" ? "Month" : "Week"}
          </th>
          <th className="py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">Entries</th>
          {numberColumns.map((c) => (
            <th key={c.id} className="py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wide text-right whitespace-nowrap">
              {c.name} (sum)
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={numberColumns.length + 2} className="py-8 text-[12.5px] text-center text-slate-400">
              No dated rows to summarize yet.
            </td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.key} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-[12.5px] font-medium text-slate-800 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2 text-[12.5px] text-right text-slate-500">{r.count}</td>
              {numberColumns.map((c) => (
                <td key={c.id} className="px-3 py-2 text-[12.5px] text-right text-slate-700">
                  {r.sums[c.id] != null ? r.sums[c.id].toLocaleString() : "—"}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const TableSheet: React.FC<{ tableId: number; isAdmin: boolean; tableName: string; isDefaultTable: boolean }> = ({
  tableId,
  isAdmin,
  tableName,
  isDefaultTable,
}) => {
  const { data, isLoading, isError, error } = usePlantReportTableDetail(tableId);
  const createRowMutation = useCreatePlantReportRow();
  const updateRowMutation = useUpdatePlantReportRow();
  const deleteRowMutation = useDeletePlantReportRow();
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<PlantReportColumn | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<PlantReportRow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [dateColumnId, setDateColumnId] = useState<number | "">("");

  const dateColumns = useMemo(() => (data?.columns ?? []).filter((c) => c.dataType === "date"), [data]);
  const numberColumns = useMemo(() => (data?.columns ?? []).filter((c) => c.dataType === "number"), [data]);

  useEffect(() => {
    if (!dateColumnId && dateColumns.length > 0) setDateColumnId(dateColumns[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateColumns]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorBanner message={getErrorMessage(error, "Failed to load table.")} className="m-6" />;
  }

  const { columns, rows } = data;
  const dateColumn = dateColumns.find((c) => c.id === dateColumnId) ?? null;
  const aggregatedRows =
    granularity !== "daily" && dateColumn ? aggregateRows(rows, dateColumn, numberColumns, granularity) : [];

  const commitCell = (row: PlantReportRow, column: PlantReportColumn, value: PlantReportCellValue) => {
    const nextValues = { ...row.values, [String(column.id)]: value };
    updateRowMutation.mutate(
      { id: row.id, tableId, payload: { values: nextValues } },
      { onError: (err) => setActionError(getErrorMessage(err, "Failed to save cell.")) },
    );
  };

  const addRow = () => {
    createRowMutation.mutate(
      { tableId, payload: { values: {} } },
      { onError: (err) => setActionError(getErrorMessage(err, "Failed to add row.")) },
    );
  };

  const toggleRowSelected = (id: number, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      await Promise.all(Array.from(selectedRowIds).map((id) => deleteRowMutation.mutateAsync({ id, tableId })));
      setSelectedRowIds(new Set());
      setConfirmBulkDelete(false);
    } catch (err) {
      setActionError(getErrorMessage(err, "Failed to delete selected rows."));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
            {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                disabled={g !== "daily" && dateColumns.length === 0}
                title={g !== "daily" && dateColumns.length === 0 ? "Add a Date column to see this view" : undefined}
                className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  granularity === g ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          {granularity !== "daily" && dateColumns.length > 1 && (
            <select
              value={dateColumnId}
              onChange={(e) => setDateColumnId(Number(e.target.value))}
              className={inputCls}
              style={{ width: 160 }}
            >
              {dateColumns.map((c) => (
                <option key={c.id} value={c.id}>
                  Group by: {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode((v) => !v)}
            title={editMode ? "Lock table from edits" : "Enable editing cells directly in the table"}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium rounded-lg border transition-colors ${
              editMode ? "bg-blue-900 text-white border-blue-900 hover:bg-blue-800" : "text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Pencil size={13} />
            {editMode ? "Editing" : "Edit"}
          </button>
          <ExportSheetButton tableName={tableName} columns={columns} rows={rows} />
          <UploadSheetButton tableId={tableId} existingColumns={columns} />
        </div>
      </div>

      {actionError && <ErrorBanner message={actionError} onDismiss={() => setActionError(null)} className="mb-3" />}

      {selectedRowIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 mb-3 border rounded-lg bg-blue-50/60 border-blue-200">
          <span className="text-[12.5px] font-medium text-blue-900">
            {selectedRowIds.size} row{selectedRowIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedRowIds(new Set())}
              className="px-2.5 py-1 text-[12px] font-medium rounded-md text-slate-600 hover:bg-slate-200/60"
            >
              Clear
            </button>
            <button
              onClick={() => setConfirmBulkDelete(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              <Trash2 size={12} />
              Delete selected
            </button>
          </div>
        </div>
      )}

      {granularity !== "daily" ? (
        dateColumn ? (
          <AggregatedTable granularity={granularity} rows={aggregatedRows} numberColumns={numberColumns} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center border border-dashed rounded-xl border-slate-200">
            <p className="text-[13px] text-slate-400">Add a Date column to group entries by week or month.</p>
          </div>
        )
      ) : columns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
            <TableIcon className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-[13px] text-slate-400">No columns yet.</p>
          {isAdmin && (
            <button onClick={() => setAddColumnOpen(true)} className="text-[12.5px] font-medium text-blue-700 hover:underline">
              Add the first column
            </button>
          )}
          <p className="text-[12px] text-slate-400">or use "Upload Sheet" above to import one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border rounded-xl shadow-sm border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="w-8 px-2 py-2.5 border-r border-slate-100">
                  {rows.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedRowIds.size === rows.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedRowIds.size > 0 && selectedRowIds.size < rows.length;
                      }}
                      onChange={(e) => setSelectedRowIds(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                      className="w-3.5 h-3.5 rounded accent-blue-800"
                    />
                  )}
                </th>
                {columns.map((col) => (
                  <th key={col.id} className="py-2.5 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap border-r border-slate-100 last:border-r-0">
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      <span className="text-[9px] font-semibold normal-case text-slate-400">({col.dataType})</span>
                      {isAdmin && (
                        <button onClick={() => setEditingColumn(col)} className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200">
                          <Pencil size={10} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-3 w-10">
                  {isAdmin && (
                    <button onClick={() => setAddColumnOpen(true)} title="Add column" className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50">
                      <Plus size={14} />
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="py-8 text-[12.5px] text-center text-slate-400">
                    No rows yet — add one below.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${
                      selectedRowIds.has(row.id) ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <td className="px-2 py-1 border-r border-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedRowIds.has(row.id)}
                        onChange={(e) => toggleRowSelected(row.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-blue-800"
                      />
                    </td>
                    {columns.map((col) => (
                      <td key={col.id} className="px-2 py-1 border-r border-slate-50 last:border-r-0">
                        <Cell
                          column={col}
                          value={row.values[String(col.id)] ?? null}
                          onCommit={(v) => commitCell(row, col, v)}
                          editable={editMode}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <button
                        onClick={() => setConfirmDeleteRow(row)}
                        title="Delete row"
                        className="p-1 rounded text-slate-300 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-100">
            <button
              onClick={addRow}
              disabled={createRowMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-medium text-blue-700 hover:bg-blue-50/50 disabled:opacity-60"
            >
              {createRowMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Add Row
            </button>
          </div>
        </div>
      )}

      {addColumnOpen && <AddColumnModal tableId={tableId} onClose={() => setAddColumnOpen(false)} />}
      {editingColumn && (
        <EditColumnModal
          tableId={tableId}
          column={editingColumn}
          isLastDateColumnOfDefaultTable={isDefaultTable && editingColumn.dataType === "date" && dateColumns.length <= 1}
          onClose={() => setEditingColumn(null)}
        />
      )}
      <ConfirmationModal
        isOpen={!!confirmDeleteRow}
        onClose={() => setConfirmDeleteRow(null)}
        onConfirm={async () => {
          if (!confirmDeleteRow) return;
          await deleteRowMutation.mutateAsync({ id: confirmDeleteRow.id, tableId });
          setConfirmDeleteRow(null);
        }}
        title="Delete Row"
        message="Delete this row? This can't be undone."
        confirmText="Delete"
        isLoading={deleteRowMutation.isPending}
      />

      <ConfirmationModal
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Delete Rows"
        message={`Delete ${selectedRowIds.size} selected row${selectedRowIds.size === 1 ? "" : "s"}? This can't be undone.`}
        confirmText="Delete"
        isLoading={isBulkDeleting}
      />
    </div>
  );
};

// ---- Charts tab — pick any table + numeric column(s) to plot as a line or bar chart ----

const formatXValue = (value: PlantReportCellValue, dataType: PlantReportColumnDataType): string => {
  if (value == null) return "—";
  if (dataType === "date") {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return String(value);
};

/** Dropdown, checkbox-list multi-select for picking which Number columns to
 * plot — replaces the old click-to-toggle chip row with a single control. */
const ColumnMultiSelect: React.FC<{
  options: { id: number; name: string; color: string }[];
  selectedIds: number[];
  onToggle: (id: number) => void;
}> = ({ options, selectedIds, onToggle }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const label =
    selectedOptions.length === 0
      ? "Select columns"
      : selectedOptions.length <= 2
        ? selectedOptions.map((o) => o.name).join(", ")
        : `${selectedOptions.length} columns selected`;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] font-medium border rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
        style={{ minWidth: 180 }}
      >
        <div className="flex items-center flex-1 gap-1 min-w-0">
          {selectedOptions.length > 0 && selectedOptions.length <= 2 && (
            <span className="flex items-center flex-shrink-0 gap-1">
              {selectedOptions.map((o) => (
                <span key={o.id} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
              ))}
            </span>
          )}
          <span className={`truncate ${selectedOptions.length === 0 ? "text-slate-400" : ""}`}>{label}</span>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1.5 w-64 max-h-[168px] overflow-y-auto bg-white border rounded-lg shadow-lg border-slate-200 py-1.5">
          {options.map((o) => {
            const checked = selectedIds.includes(o.id);
            return (
              <label
                key={o.id}
                className="flex items-center gap-2 px-3 py-2 text-[12.5px] cursor-pointer hover:bg-slate-50 text-slate-700"
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(o.id)} className="rounded accent-blue-800" />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />
                <span className="truncate">{o.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ChartsTab: React.FC<{ tables: PlantReportTable[] }> = ({ tables }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | "">(tables[0]?.id ?? "");
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [xColumnId, setXColumnId] = useState<number | "">("");
  const [yColumnIds, setYColumnIds] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const { data, isLoading } = usePlantReportTableDetail(selectedTableId || null);
  const columns = data?.columns ?? [];
  const numberColumns = useMemo(() => columns.filter((c) => c.dataType === "number"), [columns]);

  useEffect(() => {
    setXColumnId(columns[0]?.id ?? "");
    setYColumnIds(numberColumns.slice(0, 3).map((c) => c.id));
    setGranularity("daily");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableId]);

  const xColumn = columns.find((c) => c.id === xColumnId) ?? null;
  const canGroupByPeriod = xColumn?.dataType === "date";

  useEffect(() => {
    if (!canGroupByPeriod) setGranularity("daily");
  }, [canGroupByPeriod]);

  const chartData = useMemo(() => {
    if (!data || !xColumn) return [];

    if (granularity === "daily" || xColumn.dataType !== "date") {
      return data.rows.map((row) => {
        const point: Record<string, string | number | null> = {
          x: formatXValue(row.values[String(xColumn.id)] ?? null, xColumn.dataType),
        };
        for (const yCol of numberColumns) {
          const v = row.values[String(yCol.id)];
          point[String(yCol.id)] = typeof v === "number" ? v : null;
        }
        return point;
      });
    }

    const buckets = new Map<string, { key: string; label: string; sums: Record<number, number> }>();
    for (const row of data.rows) {
      const raw = row.values[String(xColumn.id)];
      if (raw == null || raw === "") continue;
      const date = new Date(String(raw));
      if (Number.isNaN(date.getTime())) continue;
      const { key, label } = getPeriodKey(date, granularity);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, label, sums: {} };
        buckets.set(key, bucket);
      }
      for (const yCol of numberColumns) {
        const v = row.values[String(yCol.id)];
        if (typeof v === "number") bucket.sums[yCol.id] = (bucket.sums[yCol.id] ?? 0) + v;
      }
    }
    return [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => {
        const point: Record<string, string | number | null> = { x: b.label };
        for (const yCol of numberColumns) point[String(yCol.id)] = b.sums[yCol.id] ?? null;
        return point;
      });
  }, [data, xColumn, numberColumns, granularity]);

  const toggleYColumn = (id: number) => {
    setYColumnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
          <LineChartIcon className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No tables yet — add one to chart its data here.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={selectedTableId} onChange={(e) => setSelectedTableId(Number(e.target.value))} className={inputCls} style={{ width: 200 }}>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={xColumnId} onChange={(e) => setXColumnId(Number(e.target.value))} className={inputCls} style={{ width: 160 }}>
          <option value="">X axis: (none)</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              X: {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
          {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              disabled={g !== "daily" && !canGroupByPeriod}
              title={g !== "daily" && !canGroupByPeriod ? "Pick a Date column for X axis to use this view" : undefined}
              className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium capitalize transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                granularity === g ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 p-0.5 border rounded-lg border-slate-200 bg-slate-50">
          <button
            onClick={() => setChartType("line")}
            title="Line / curve chart"
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              chartType === "line" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <LineChartIcon size={14} />
          </button>
          <button
            onClick={() => setChartType("bar")}
            title="Bar chart"
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              chartType === "bar" ? "bg-white shadow-sm text-slate-800" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <BarChart3 size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : numberColumns.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center border border-dashed rounded-xl border-slate-200">
          <p className="text-[13px] text-slate-400">This table has no Number columns to plot yet.</p>
        </div>
      ) : (
        <div className="p-4 bg-white border rounded-xl shadow-md border-slate-200">
          <div className="flex items-center justify-end mb-3">
            <ColumnMultiSelect
              options={numberColumns.map((c, i) => ({ id: c.id, name: c.name, color: CHART_COLORS[i % CHART_COLORS.length] }))}
              selectedIds={yColumnIds}
              onToggle={toggleYColumn}
            />
          </div>

          {yColumnIds.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-[13px] text-slate-400">Select a column above to plot it.</div>
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                {chartType === "line" ? (
                  <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e1e0d9" vertical={false} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }} labelStyle={{ color: "#52514e", fontWeight: 600 }} />
                    {yColumnIds.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    {numberColumns
                      .filter((c) => yColumnIds.includes(c.id))
                      .map((c) => {
                        const colorIndex = numberColumns.findIndex((nc) => nc.id === c.id) % CHART_COLORS.length;
                        return (
                          <Line key={c.id} type="monotone" dataKey={String(c.id)} name={c.name} stroke={CHART_COLORS[colorIndex]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                        );
                      })}
                    {numberColumns
                      .filter((c) => yColumnIds.includes(c.id) && c.target != null)
                      .map((c) => {
                        const colorIndex = numberColumns.findIndex((nc) => nc.id === c.id) % CHART_COLORS.length;
                        return (
                          <ReferenceLine
                            key={`target-${c.id}`}
                            y={c.target as number}
                            stroke={CHART_COLORS[colorIndex]}
                            strokeDasharray="5 4"
                            strokeWidth={1.5}
                            label={{ value: `${c.name} target: ${c.target}`, position: "insideTopLeft", fontSize: 10, fill: CHART_COLORS[colorIndex] }}
                          />
                        );
                      })}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="#e1e0d9" vertical={false} />
                    <XAxis dataKey="x" tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e1e0d9" }} labelStyle={{ color: "#52514e", fontWeight: 600 }} />
                    {yColumnIds.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
                    {numberColumns
                      .filter((c) => yColumnIds.includes(c.id))
                      .map((c) => {
                        const colorIndex = numberColumns.findIndex((nc) => nc.id === c.id) % CHART_COLORS.length;
                        return <Bar key={c.id} dataKey={String(c.id)} name={c.name} fill={CHART_COLORS[colorIndex]} radius={[3, 3, 0, 0]} />;
                      })}
                    {numberColumns
                      .filter((c) => yColumnIds.includes(c.id) && c.target != null)
                      .map((c) => {
                        const colorIndex = numberColumns.findIndex((nc) => nc.id === c.id) % CHART_COLORS.length;
                        return (
                          <ReferenceLine
                            key={`target-${c.id}`}
                            y={c.target as number}
                            stroke={CHART_COLORS[colorIndex]}
                            strokeDasharray="5 4"
                            strokeWidth={1.5}
                            label={{ value: `${c.name} target: ${c.target}`, position: "insideTopLeft", fontSize: 10, fill: CHART_COLORS[colorIndex] }}
                          />
                        );
                      })}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Root page ----

const PlantReport: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const { data: projects = [] } = useProjects();

  const [projectId, setProjectId] = useState<number | "">("");
  const [activeTabId, setActiveTabId] = useState<number | "charts" | "">("");
  const [addTableOpen, setAddTableOpen] = useState(false);
  const [renamingTable, setRenamingTable] = useState<PlantReportTable | null>(null);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<PlantReportTable | null>(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const { data: tables = [], isLoading: tablesLoading } = usePlantReportTables(projectId || null);
  const createTableMutation = useCreatePlantReportTable();
  const updateTableMutation = useUpdatePlantReportTable();
  const deleteTableMutation = useDeletePlantReportTable();

  useEffect(() => {
    if (tables.length > 0 && (activeTabId === "" || (activeTabId !== "charts" && !tables.some((t) => t.id === activeTabId)))) {
      setActiveTabId(tables[0].id);
    }
  }, [tables, activeTabId]);

  const activeTable = activeTabId !== "charts" ? tables.find((t) => t.id === activeTabId) : null;

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
          <TableIcon className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-[13px] text-slate-400">No projects yet — create a project to start tracking here.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full bg-white">
      <div className="flex flex-wrap items-center gap-1 px-6 pt-3 overflow-x-auto border-b border-slate-200 bg-slate-50/60">
        <span className="mr-1.5 text-[12.5px] font-medium text-slate-600 whitespace-nowrap">Select a project:</span>
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(Number(e.target.value));
            setActiveTabId("");
          }}
          className={`${inputCls} bg-white border-2`}
          style={{ width: 200 }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="w-px h-6 mx-1 bg-slate-200" />
        {tablesLoading ? (
          <div className="px-4 py-3">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : (
          tables.map((table) => (
            <button
              key={table.id}
              onClick={() => setActiveTabId(table.id)}
              onDoubleClick={() => isAdmin && !table.isDefault && setRenamingTable(table)}
              className={`group flex items-center gap-1.5 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors ${
                activeTabId === table.id ? "border-slate-900 text-black font-semibold" : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              }`}
            >
              {table.name}
              {isAdmin && !table.isDefault && activeTabId === table.id && (
                <span className="flex items-center gap-1">
                  <Pencil
                    size={11}
                    className="text-slate-400 hover:text-slate-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingTable(table);
                    }}
                  />
                  <Trash2
                    size={11}
                    className="text-slate-400 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteTable(table);
                    }}
                  />
                </span>
              )}
            </button>
          ))
        )}

        <button
          onClick={() => setActiveTabId("charts")}
          className={`flex items-center gap-1.5 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors ${
            activeTabId === "charts" ? "border-slate-900 text-black font-semibold" : "border-transparent font-medium text-slate-500 hover:text-slate-700"
          }`}
        >
          <LineChartIcon size={14} className="opacity-70" /> Charts
        </button>

        {isAdmin && (
          <button
            onClick={() => setAddTableOpen(true)}
            title="Add tab"
            className="flex items-center justify-center flex-shrink-0 w-8 h-8 my-1.5 ml-1 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {activeTabId === "charts" ? (
        <ChartsTab tables={tables} />
      ) : activeTable ? (
        <TableSheet key={activeTable.id} tableId={activeTable.id} isAdmin={isAdmin} tableName={activeTable.name} isDefaultTable={activeTable.isDefault} />
      ) : null}

      {addTableOpen && projectId && (
        <TableNameModal
          title="Add Tab"
          confirmLabel="Add Tab"
          onSave={async (name) => {
            const created = await createTableMutation.mutateAsync({ projectId, payload: { name } });
            setActiveTabId(created.id);
          }}
          onClose={() => setAddTableOpen(false)}
        />
      )}

      {renamingTable && projectId && (
        <TableNameModal
          title="Rename Tab"
          initialName={renamingTable.name}
          confirmLabel="Save"
          onSave={async (name) => {
            await updateTableMutation.mutateAsync({ id: renamingTable.id, projectId, payload: { name } });
          }}
          onClose={() => setRenamingTable(null)}
        />
      )}

      <ConfirmationModal
        isOpen={!!confirmDeleteTable}
        onClose={() => setConfirmDeleteTable(null)}
        onConfirm={async () => {
          if (!confirmDeleteTable || !projectId) return;
          await deleteTableMutation.mutateAsync({ id: confirmDeleteTable.id, projectId });
          setActiveTabId("");
          setConfirmDeleteTable(null);
        }}
        title="Delete Tab"
        message={`Delete "${confirmDeleteTable?.name}"? All its columns and rows will be deleted too.`}
        confirmText="Delete"
        isLoading={deleteTableMutation.isPending}
      />
    </div>
  );
};

export default PlantReport;