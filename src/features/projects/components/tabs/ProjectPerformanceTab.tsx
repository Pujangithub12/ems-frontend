import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Check,
  Upload,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthProvider";
import { Project, MonthlyPerformance, GenerationSummaryBucket } from "../../../../types";
import { toNumber, formatCost } from "../../../../lib/currency";
import { formatEnergy, MonthlyPerformanceInput, UpsertDailyGenerationInput } from "../../api/performance.api";
import {
  useMonthlyPerformanceQuery,
  useUpsertMonthlyPerformanceMutation,
  useDailyGenerationQuery,
  useUpsertDailyGenerationMutation,
  useDeleteDailyGenerationMutation,
  useGenerationBucketsQuery,
} from "../../hooks/useMonthlyPerformance";
import { getErrorMessage } from "../../../../lib/errors";
import ConfirmationModal from "../../../../components/ConfirmationModal";
import EnergyPerformanceChart, { EnergyChartPoint } from "../../../../components/charts/EnergyPerformanceChart";
import {
  daysInBsMonth,
  bsMonthLabel,
  bsMonthRangeAd,
  adDateForBsDay,
  currentBsYearMonth,
  bsDateLabel,
  adDateLabel,
  bsMonthAdLabel,
  daysInAdMonth,
  adMonthRangeIso,
  adDateForAdDay,
  currentAdYearMonth,
  adMonthLabelFull,
  adMonthLabel,
  bsMonthPrimaryAdYearMonth,
} from "../../../../lib/bsDate";

interface ProjectPerformanceTabProps {
  project: Project;
}

const emptyForm = {
  contractEnergy: "",
  incomeReceived: "",
  monthlyExpenditure: "",
  sparePartPurchase: "",
};

const emptyMeterForm = {
  checkMeterInitial: "",
  checkMeterFinal: "",
  mainMeterInitial: "",
  mainMeterFinal: "",
};

const diff = (initial: string, final: string): number | null => {
  if (initial === "" || final === "") return null;
  const i = Number(initial);
  const f = Number(final);
  return Number.isNaN(i) || Number.isNaN(f) ? null : f - i;
};

// BS months are zero-based internally (nepali-date-converter convention);
// this is 1-based purely for display / financial-table row keys.
const BS_MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i);

const ProjectPerformanceTab: React.FC<ProjectPerformanceTabProps> = ({ project }) => {
  const projectId = String(project.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { year: initialYear, month: initialMonth } = useMemo(() => currentBsYearMonth(), []);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const { year: initialAdYear, month: initialAdMonth } = useMemo(() => currentAdYearMonth(), []);
  const [adYear, setAdYear] = useState(initialAdYear);
  const [adMonth, setAdMonth] = useState(initialAdMonth);
  const [chartMode, setChartMode] = useState<"daily" | "monthly">("daily");
  // Controls both display AND, for the daily grid specifically, which
  // calendar's month boundaries entries are grouped/navigated by — so e.g.
  // Shrawan 31 and Bhadra 1 land together under "Aug" in AD mode if that's
  // what the real calendar says. Contract Energy/Income/Expenditure/Spare
  // Parts (financial fields) stay BS-anchored regardless, since those are
  // single figures an admin enters for one BS month and can't be honestly
  // split across an AD month boundary.
  const [dateFormat, setDateFormat] = useState<"bs" | "ad">("bs");
  const dateLabel = (dateIso: string) => (dateFormat === "bs" ? bsDateLabel(dateIso) : adDateLabel(dateIso));

  // The period currently driving the daily grid (Add Entry, Upload Sheet,
  // the entries table, and the daily-mode chart) — BS or AD depending on dateFormat.
  const dim = dateFormat === "bs" ? daysInBsMonth(year, month) : daysInAdMonth(adYear, adMonth);
  const periodLabel =
    dateFormat === "bs" ? `${bsMonthLabel(year, month)} ${year}` : adMonthLabelFull(adYear, adMonth);
  const periodDateForDay = (day: number) =>
    dateFormat === "bs" ? adDateForBsDay(year, month, day) : adDateForAdDay(adYear, adMonth, day);
  const periodDayLabel = (day: number) =>
    dateFormat === "bs"
      ? `${bsMonthLabel(year, month)} ${day}`
      : `${new Date(adYear, adMonth, 1).toLocaleDateString("en-US", { month: "long" })} ${day}`;

  // MonthlyPerformance.year/month are stored as 1-based BS values (Baishakh = 1).
  const rowsQuery = useMonthlyPerformanceQuery(projectId, year);
  const rows = rowsQuery.data ?? [];
  const loading = rowsQuery.isLoading;
  const error = rowsQuery.isError
    ? getErrorMessage(rowsQuery.error, "Failed to load energy performance data.")
    : null;

  const upsertMutation = useUpsertMonthlyPerformanceMutation();

  const { startDate, endDate } = useMemo(
    () => (dateFormat === "bs" ? bsMonthRangeAd(year, month) : adMonthRangeIso(adYear, adMonth)),
    [dateFormat, year, month, adYear, adMonth],
  );
  const dailyQuery = useDailyGenerationQuery(projectId, startDate, endDate);
  const upsertDailyMutation = useUpsertDailyGenerationMutation();
  const deleteDailyMutation = useDeleteDailyGenerationMutation();

  // BS-month buckets — always fetched, since financial fields (Contract Energy
  // etc.) stay BS-anchored regardless of dateFormat.
  const buckets: GenerationSummaryBucket[] = useMemo(
    () =>
      BS_MONTH_INDEXES.map((m) => {
        const range = bsMonthRangeAd(year, m);
        return { key: m + 1, ...range };
      }),
    [year],
  );
  const bucketsQuery = useGenerationBucketsQuery(projectId, year, buckets, "bs");
  const bucketByMonth = useMemo(() => {
    const map = new Map<number, number | null>();
    (bucketsQuery.data ?? []).forEach((b) => map.set(b.key, b.generation != null ? toNumber(b.generation) : null));
    return map;
  }, [bucketsQuery.data]);

  // True AD-month buckets (key = AD month index 0-11 of adYear) — only used
  // by the monthly table when dateFormat === "ad", so it can show a correct
  // Actual Generation sum per real Gregorian month instead of an approximated
  // BS-bucket value (fixes e.g. Shrawan 31 + Bhadra 1 both being in "August").
  const adMonthlyBuckets: GenerationSummaryBucket[] = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({ key: m, ...adMonthRangeIso(adYear, m) })),
    [adYear],
  );
  const adBucketsQuery = useGenerationBucketsQuery(projectId, adYear, adMonthlyBuckets, "ad");
  const adBucketByMonth = useMemo(() => {
    const map = new Map<number, number | null>();
    (adBucketsQuery.data ?? []).forEach((b) => map.set(b.key, b.generation != null ? toNumber(b.generation) : null));
    return map;
  }, [adBucketsQuery.data]);

  const rowsByMonth = useMemo(() => {
    const map = new Map<number, MonthlyPerformance>();
    rows.forEach((r) => map.set(r.month, r));
    return map;
  }, [rows]);

  // For each true AD month (0-11) of adYear, the one BS month (1-12) whose
  // "primary" AD month (see bsMonthPrimaryAdYearMonth) is exactly this AD
  // month — or null if none map here, or if more than one does (ambiguous).
  // Only covers the currently-loaded BS `year`, so a BS month from an
  // adjacent BS year that happens to primarily fall in this AD year's edge
  // months (e.g. AD January) won't be found — a known, accepted limitation.
  const adPrimaryBsMonth = useMemo(() => {
    const buckets2 = new Map<number, number[]>();
    BS_MONTH_INDEXES.forEach((idx) => {
      const primary = bsMonthPrimaryAdYearMonth(year, idx);
      if (primary.year !== adYear) return;
      const arr = buckets2.get(primary.month) ?? [];
      arr.push(idx + 1);
      buckets2.set(primary.month, arr);
    });
    const map = new Map<number, number | null>();
    for (let m = 0; m < 12; m++) {
      const arr = buckets2.get(m) ?? [];
      map.set(m, arr.length === 1 ? arr[0] : null);
    }
    return map;
  }, [year, adYear]);

  // Rows the financial table actually renders — 12 BS months (label + BS
  // month number to look up financial fields + Actual Generation), or 12 true
  // AD months (label + the mapped BS month, if unambiguous, for financial
  // fields only — Actual Generation is always a true AD sum in this mode).
  const monthRows = useMemo(() => {
    if (dateFormat === "bs") {
      return BS_MONTH_INDEXES.map((idx) => ({
        key: idx + 1,
        label: bsMonthLabel(year, idx),
        bsMonth: idx + 1,
        generation: bucketByMonth.get(idx + 1) ?? null,
      }));
    }
    return Array.from({ length: 12 }, (_, m) => ({
      key: m,
      label: adMonthLabel(adYear, m),
      bsMonth: adPrimaryBsMonth.get(m) ?? null,
      generation: adBucketByMonth.get(m) ?? null,
    }));
  }, [dateFormat, year, adYear, bucketByMonth, adBucketByMonth, adPrimaryBsMonth]);

  const totals = useMemo(() => {
    const sum = (key: keyof MonthlyPerformance) =>
      monthRows.reduce((acc, r) => {
        const row = r.bsMonth ? rowsByMonth.get(r.bsMonth) : undefined;
        return acc + toNumber(row?.[key] as number | string | null);
      }, 0);
    const actualGeneration = monthRows.reduce((acc, r) => acc + (r.generation ?? 0), 0);
    return {
      contractEnergy: sum("contractEnergy"),
      actualGeneration,
      incomeReceived: sum("incomeReceived"),
      monthlyExpenditure: sum("monthlyExpenditure"),
      sparePartPurchase: sum("sparePartPurchase"),
    };
  }, [monthRows, rowsByMonth]);

  // Only days that actually have a logged value are shown — entries are added
  // one at a time via the "Add Entry" form below, or in bulk via "Upload Sheet".
  const dailyEntries = useMemo(
    () =>
      (dailyQuery.data ?? [])
        .filter((d) => d.generation !== null && d.generation !== undefined)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [dailyQuery.data],
  );

  const dailyTotal = useMemo(
    () => dailyEntries.reduce((acc, d) => acc + toNumber(d.generation), 0),
    [dailyEntries],
  );

  const loggedDates = useMemo(() => new Set(dailyEntries.map((d) => d.date)), [dailyEntries]);
  const firstOpenDay = useMemo(() => {
    for (let day = 1; day <= dim; day++) {
      if (!loggedDates.has(periodDateForDay(day))) return day;
    }
    return 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- periodDateForDay is derived from these same values each render
  }, [dateFormat, year, month, adYear, adMonth, dim, loggedDates]);

  const [addOpen, setAddOpen] = useState(false);
  const [addDay, setAddDay] = useState(1);
  const [addMeter, setAddMeter] = useState(emptyMeterForm);
  const [addError, setAddError] = useState<string | null>(null);

  const openAddForm = () => {
    setAddDay(firstOpenDay);
    setAddMeter(emptyMeterForm);
    setAddError(null);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (Object.values(addMeter).every((v) => v === "")) {
      setAddError("Enter at least one meter reading.");
      return;
    }
    setAddError(null);
    const date = periodDateForDay(addDay);
    await upsertDailyMutation.mutateAsync({
      projectId,
      input: {
        date,
        checkMeterInitial: addMeter.checkMeterInitial === "" ? null : Number(addMeter.checkMeterInitial),
        checkMeterFinal: addMeter.checkMeterFinal === "" ? null : Number(addMeter.checkMeterFinal),
        mainMeterInitial: addMeter.mainMeterInitial === "" ? null : Number(addMeter.mainMeterInitial),
        mainMeterFinal: addMeter.mainMeterFinal === "" ? null : Number(addMeter.mainMeterFinal),
      },
    });
    setAddOpen(false);
  };

  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editMeter, setEditMeter] = useState(emptyMeterForm);

  const startEdit = (d: { date: string; checkMeterInitial?: number | string | null; checkMeterFinal?: number | string | null; mainMeterInitial?: number | string | null; mainMeterFinal?: number | string | null }) => {
    setEditingDate(d.date);
    setEditMeter({
      checkMeterInitial: d.checkMeterInitial != null ? String(toNumber(d.checkMeterInitial)) : "",
      checkMeterFinal: d.checkMeterFinal != null ? String(toNumber(d.checkMeterFinal)) : "",
      mainMeterInitial: d.mainMeterInitial != null ? String(toNumber(d.mainMeterInitial)) : "",
      mainMeterFinal: d.mainMeterFinal != null ? String(toNumber(d.mainMeterFinal)) : "",
    });
  };

  const submitEdit = async () => {
    if (editingDate === null) return;
    await upsertDailyMutation.mutateAsync({
      projectId,
      input: {
        date: editingDate,
        checkMeterInitial: editMeter.checkMeterInitial === "" ? null : Number(editMeter.checkMeterInitial),
        checkMeterFinal: editMeter.checkMeterFinal === "" ? null : Number(editMeter.checkMeterFinal),
        mainMeterInitial: editMeter.mainMeterInitial === "" ? null : Number(editMeter.mainMeterInitial),
        mainMeterFinal: editMeter.mainMeterFinal === "" ? null : Number(editMeter.mainMeterFinal),
      },
    });
    setEditingDate(null);
  };

  // Multi-select + delete for daily entries.
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);

  const toggleSelected = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedDates((prev) =>
      prev.size === dailyEntries.length ? new Set() : new Set(dailyEntries.map((d) => d.date)),
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteDailyMutation.mutateAsync({ projectId, dates: deleteTarget });
    setSelectedDates((prev) => {
      const next = new Set(prev);
      deleteTarget.forEach((d) => next.delete(d));
      return next;
    });
    setDeleteTarget(null);
  };

  const navigateMonth = (dir: -1 | 1) => {
    if (dateFormat === "ad") {
      let m = adMonth + dir;
      let y = adYear;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      setAdMonth(m);
      setAdYear(y);
      return;
    }
    let m = month + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const chartData: EnergyChartPoint[] = useMemo(() => {
    if (chartMode === "daily") {
      // Contract Energy is BS-anchored (see dateFormat comment above) — only
      // meaningful as a target line when the grid itself is BS-grouped.
      const contractEnergy =
        dateFormat === "bs" ? toNumber(rowsByMonth.get(month + 1)?.contractEnergy ?? null) : 0;
      const target = contractEnergy > 0 ? contractEnergy / dim : null;
      return Array.from({ length: dim }, (_, i) => {
        const day = i + 1;
        const date = periodDateForDay(day);
        const entry = (dailyQuery.data ?? []).find((d) => d.date === date);
        return {
          label: String(day),
          value: entry?.generation != null ? toNumber(entry.generation) : null,
          target,
        };
      });
    }
    return BS_MONTH_INDEXES.map((m) => ({
      label: bsMonthLabel(year, m).slice(0, 3),
      value: bucketByMonth.get(m + 1) ?? null,
      target: rowsByMonth.get(m + 1)?.contractEnergy != null ? toNumber(rowsByMonth.get(m + 1)!.contractEnergy) : null,
    }));
  }, [chartMode, dailyQuery.data, bucketByMonth, rowsByMonth, month, year, adMonth, adYear, dateFormat, dim]);

  // Bulk import via .xlsx/.csv — parsed entirely client-side, matches columns
  // from a real generation log sheet (Day, Check/Main Meter Initial/Final).
  // "Upload Sheet" opens a modal explaining the expected format before the
  // native file picker runs, since the column layout is specific.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const findColumn = (header: string[], needle: string) =>
    header.findIndex((h) => (h || "").toString().toLowerCase().includes(needle));

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadModalOpen(false);
    setImporting(true);
    setImportStatus(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows2d: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

      const headerRowIdx = rows2d.findIndex((r) => r.some((c) => String(c).trim().toLowerCase() === "day"));
      if (headerRowIdx === -1) {
        setImportStatus("Couldn't find a header row with a \"Day\" column.");
        return;
      }
      const header = rows2d[headerRowIdx].map((c) => String(c));
      const dayCol = findColumn(header, "day");
      const checkInitCol = findColumn(header, "check meter initial");
      const checkFinalCol = findColumn(header, "check meter final");
      const mainInitCol = findColumn(header, "main meter initial");
      const mainFinalCol = findColumn(header, "main meter final");

      let imported = 0;
      let skipped = 0;
      for (let i = headerRowIdx + 1; i < rows2d.length; i++) {
        const r = rows2d[i];
        const dayRaw = r[dayCol];
        const day = typeof dayRaw === "number" ? dayRaw : parseInt(String(dayRaw), 10);
        if (!Number.isInteger(day) || day < 1 || day > dim) break; // stops at TOTAL row / end of data

        const checkMeterInitial = checkInitCol >= 0 && r[checkInitCol] !== "" ? Number(r[checkInitCol]) : null;
        const checkMeterFinal = checkFinalCol >= 0 && r[checkFinalCol] !== "" ? Number(r[checkFinalCol]) : null;
        const mainMeterInitial = mainInitCol >= 0 && r[mainInitCol] !== "" ? Number(r[mainInitCol]) : null;
        const mainMeterFinal = mainFinalCol >= 0 && r[mainFinalCol] !== "" ? Number(r[mainFinalCol]) : null;

        if (checkMeterInitial === null && checkMeterFinal === null && mainMeterInitial === null && mainMeterFinal === null) {
          skipped += 1;
          continue;
        }

        const input: UpsertDailyGenerationInput = {
          date: periodDateForDay(day),
          checkMeterInitial,
          checkMeterFinal,
          mainMeterInitial,
          mainMeterFinal,
        };
        // eslint-disable-next-line no-await-in-loop -- sequential upserts keep per-row error attribution simple
        await upsertDailyMutation.mutateAsync({ projectId, input });
        imported += 1;
      }

      setImportStatus(`${imported} day${imported === 1 ? "" : "s"} imported${skipped ? `, ${skipped} skipped` : ""}.`);
    } catch (err) {
      setImportStatus(getErrorMessage(err, "Failed to import the file."));
    } finally {
      setImporting(false);
    }
  };

  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openEditForm = (m: number) => {
    const existing = rowsByMonth.get(m);
    setEditingMonth(m);
    setForm({
      contractEnergy: existing?.contractEnergy != null ? String(toNumber(existing.contractEnergy)) : "",
      incomeReceived:
        existing?.incomeReceived != null ? String(toNumber(existing.incomeReceived)) : "",
      monthlyExpenditure:
        existing?.monthlyExpenditure != null ? String(toNumber(existing.monthlyExpenditure)) : "",
      sparePartPurchase:
        existing?.sparePartPurchase != null ? String(toNumber(existing.sparePartPurchase)) : "",
    });
    setFormError(null);
  };

  const closeForm = () => {
    setEditingMonth(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const toInput = (value: string): number | null => (value === "" ? null : Number(value));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMonth === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: MonthlyPerformanceInput = {
        year,
        month: editingMonth,
        contractEnergy: toInput(form.contractEnergy),
        incomeReceived: toInput(form.incomeReceived),
        monthlyExpenditure: toInput(form.monthlyExpenditure),
        sparePartPurchase: toInput(form.sparePartPurchase),
      };
      await upsertMutation.mutateAsync({ projectId, input: payload });
      await rowsQuery.refetch();
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save monthly performance."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading energy performance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <AlertCircle className="w-6 h-6 text-red-600" />
        <p className="text-[13px] text-slate-600">{error}</p>
        <button
          onClick={() => rowsQuery.refetch()}
          className="mt-2 px-3 py-1.5 text-[12px] font-medium text-blue-900 border border-slate-200 rounded hover:bg-slate-50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Trend chart */}
      <div className="p-4 bg-white border rounded-lg border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-slate-900">Generation Trend</h3>
          <div className="flex text-[11px] border rounded-lg border-slate-200 overflow-hidden">
            <button
              onClick={() => setChartMode("daily")}
              className={`px-3 py-1.5 font-medium ${chartMode === "daily" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Daily
            </button>
            <button
              onClick={() => setChartMode("monthly")}
              className={`px-3 py-1.5 font-medium ${chartMode === "monthly" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Monthly trend
            </button>
          </div>
        </div>
        <EnergyPerformanceChart
          data={chartData}
          navigatorLabel={chartMode === "daily" ? periodLabel : `${year}`}
          onNavigate={(dir) => (chartMode === "daily" ? navigateMonth(dir) : setYear((y) => y + dir))}
        />
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-slate-900">Daily Generation Entry</h3>
        <div className="flex items-center gap-2">
          {isAdmin && selectedDates.size > 0 && (
            <button
              onClick={() => setDeleteTarget(Array.from(selectedDates))}
              className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <Trash2 size={14} />
              Delete Selected ({selectedDates.size})
            </button>
          )}
          {isAdmin && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelected}
              />
              <button
                onClick={() => setUploadModalOpen(true)}
                disabled={importing}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Upload Sheet
              </button>
              <button
                onClick={openAddForm}
                className="flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
              >
                <Plus size={14} />
                Add Entry
              </button>
            </>
          )}
          <div className="flex text-[11px] border rounded-lg border-slate-200 overflow-hidden">
            <button
              onClick={() => setDateFormat("bs")}
              className={`px-2.5 py-1.5 font-medium ${dateFormat === "bs" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="Show dates in Bikram Sambat"
            >
              BS
            </button>
            <button
              onClick={() => setDateFormat("ad")}
              className={`px-2.5 py-1.5 font-medium ${dateFormat === "ad" ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              title="Show dates in English (Gregorian)"
            >
              AD
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="w-32 text-center text-[13px] font-semibold text-slate-900"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {periodLabel}
            </span>
            <button
              onClick={() => navigateMonth(1)}
              className="flex items-center justify-center w-8 h-8 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
              title="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {importStatus && (
        <div className="px-3 py-2 text-[12px] text-slate-600 bg-slate-50 border border-slate-200 rounded">
          {importStatus}
        </div>
      )}

      {/* Upload Sheet modal — explains the expected column layout before the native file picker opens. */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">Upload Generation Sheet</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3 text-[12px] text-slate-600">
              <p>
                The file must have a header row with a <span className="font-medium text-slate-800">Day</span>{" "}
                column plus these four meter-reading columns (any order, extra columns are ignored):
              </p>
              <ul className="pl-4 space-y-1 list-disc marker:text-slate-400">
                <li>Check Meter Initial Reading</li>
                <li>Check Meter Final Reading</li>
                <li>Main Meter Initial Reading</li>
                <li>Main Meter Final Reading</li>
              </ul>
              <p>
                Each row's <span className="font-medium text-slate-800">Day</span> (1, 2, 3…) is matched against the
                currently selected month —{" "}
                <span className="font-medium text-slate-800">{periodLabel}</span>{" "}
                — so make sure that's the right month before uploading. A trailing{" "}
                <span className="font-medium text-slate-800">TOTAL</span> row (or anything after the daily rows) is
                automatically ignored. Accepted formats: .xlsx, .xls, .csv.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800"
                >
                  <Upload size={14} />
                  Choose File & Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add entry form */}
      {addOpen && (
        <div className="p-3 bg-white border rounded-lg border-slate-200">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Day</label>
              <select
                value={addDay}
                onChange={(e) => setAddDay(Number(e.target.value))}
                className="px-2 py-1.5 text-[12px] border rounded outline-none border-slate-200 focus:border-blue-400"
              >
                {Array.from({ length: dim }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {periodDayLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Check Meter Initial</label>
              <input
                autoFocus
                type="number"
                step="0.01"
                value={addMeter.checkMeterInitial}
                onChange={(e) => setAddMeter({ ...addMeter, checkMeterInitial: e.target.value })}
                className="px-2 py-1.5 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Check Meter Final</label>
              <input
                type="number"
                step="0.01"
                value={addMeter.checkMeterFinal}
                onChange={(e) => setAddMeter({ ...addMeter, checkMeterFinal: e.target.value })}
                className="px-2 py-1.5 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
              />
            </div>
            <p className="pb-2 text-[12px] text-slate-500">
              Diff: {formatEnergy(diff(addMeter.checkMeterInitial, addMeter.checkMeterFinal))}
            </p>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Main Meter Initial</label>
              <input
                type="number"
                step="0.01"
                value={addMeter.mainMeterInitial}
                onChange={(e) => setAddMeter({ ...addMeter, mainMeterInitial: e.target.value })}
                className="px-2 py-1.5 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block mb-1 text-[11px] font-medium text-slate-500">Main Meter Final</label>
              <input
                type="number"
                step="0.01"
                value={addMeter.mainMeterFinal}
                onChange={(e) => setAddMeter({ ...addMeter, mainMeterFinal: e.target.value })}
                className="px-2 py-1.5 text-[12px] border rounded outline-none w-28 border-slate-200 focus:border-blue-400"
              />
            </div>
            <p className="pb-2 text-[12px] text-slate-500">
              Diff: {formatEnergy(diff(addMeter.mainMeterInitial, addMeter.mainMeterFinal))}
            </p>
            <button
              onClick={submitAdd}
              disabled={upsertDailyMutation.isPending}
              className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              Save
            </button>
            <button
              onClick={() => setAddOpen(false)}
              className="px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {addError && <p className="mt-2 text-[11px] text-red-600">{addError}</p>}
        </div>
      )}

      {/* Daily entries — only days that have been logged; add more via "Add Entry"/"Upload Sheet" above. */}
      <div className="overflow-hidden bg-white border rounded-lg border-slate-200">
        {dailyQuery.isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
          </div>
        ) : dailyEntries.length === 0 ? (
          <p className="px-3 py-6 text-[12px] text-center text-slate-400">
            No daily entries logged for {periodLabel} yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-[12px] whitespace-nowrap">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                    {isAdmin && (
                      <th className="w-8 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedDates.size > 0 && selectedDates.size === dailyEntries.length}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium text-left">Date</th>
                    <th className="px-3 py-2 font-medium text-left">Check Init.</th>
                    <th className="px-3 py-2 font-medium text-left">Check Final</th>
                    <th className="px-3 py-2 font-medium text-left">Check Diff.</th>
                    <th className="px-3 py-2 font-medium text-left">Main Init.</th>
                    <th className="px-3 py-2 font-medium text-left">Main Final</th>
                    <th className="px-3 py-2 font-medium text-left">Main Diff.</th>
                    {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {dailyEntries.map((d) => {
                    const isEditing = editingDate === d.date;
                    return (
                      <tr key={d.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedDates.has(d.date)}
                              onChange={() => toggleSelected(d.date)}
                              className="rounded border-slate-300"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 text-slate-600">{dateLabel(d.date)}</td>
                        {isEditing ? (
                          <>
                            <td className="px-2 py-2">
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                value={editMeter.checkMeterInitial}
                                onChange={(e) => setEditMeter({ ...editMeter, checkMeterInitial: e.target.value })}
                                className="px-2 py-1 text-[12px] border rounded outline-none w-24 border-slate-200 focus:border-blue-400"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editMeter.checkMeterFinal}
                                onChange={(e) => setEditMeter({ ...editMeter, checkMeterFinal: e.target.value })}
                                className="px-2 py-1 text-[12px] border rounded outline-none w-24 border-slate-200 focus:border-blue-400"
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {formatEnergy(diff(editMeter.checkMeterInitial, editMeter.checkMeterFinal))}
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editMeter.mainMeterInitial}
                                onChange={(e) => setEditMeter({ ...editMeter, mainMeterInitial: e.target.value })}
                                className="px-2 py-1 text-[12px] border rounded outline-none w-24 border-slate-200 focus:border-blue-400"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={editMeter.mainMeterFinal}
                                onChange={(e) => setEditMeter({ ...editMeter, mainMeterFinal: e.target.value })}
                                className="px-2 py-1 text-[12px] border rounded outline-none w-24 border-slate-200 focus:border-blue-400"
                              />
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {formatEnergy(diff(editMeter.mainMeterInitial, editMeter.mainMeterFinal))}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-slate-600">{formatEnergy(d.checkMeterInitial)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatEnergy(d.checkMeterFinal)}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{formatEnergy(d.checkMeterDifference)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatEnergy(d.mainMeterInitial)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatEnergy(d.mainMeterFinal)}</td>
                            <td className="px-3 py-2 text-slate-600">{formatEnergy(d.mainMeterDifference)}</td>
                          </>
                        )}
                        {isAdmin && (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={submitEdit}
                                    className="flex items-center justify-center w-7 h-7 text-emerald-600 hover:bg-slate-100 rounded"
                                    title="Save"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingDate(null)}
                                    className="flex items-center justify-center w-7 h-7 text-slate-500 hover:bg-slate-100 rounded"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEdit(d)}
                                    className="flex items-center justify-center w-7 h-7 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget([d.date])}
                                    className="flex items-center justify-center w-7 h-7 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                    <td className="px-3 py-2" colSpan={isAdmin ? 4 : 3}>
                      Total (Check Meter)
                    </td>
                    <td className="px-3 py-2">{formatEnergy(dailyTotal)}</td>
                    <td className="px-3 py-2" colSpan={isAdmin ? 3 : 2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Financial fields table */}
      <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-lg border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wide">
                <th className="px-3 py-2 font-medium text-left">Month</th>
                <th className="px-3 py-2 font-medium text-left">Contract Energy</th>
                <th className="px-3 py-2 font-medium text-left">Actual Generation</th>
                <th className="px-3 py-2 font-medium text-left">Income Received</th>
                <th className="px-3 py-2 font-medium text-left">Monthly Expenditure</th>
                <th className="px-3 py-2 font-medium text-left">Spare Part Purchase</th>
                {isAdmin && <th className="px-3 py-2 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => {
                const row = r.bsMonth ? rowsByMonth.get(r.bsMonth) : undefined;
                return (
                  <tr key={r.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.label}</td>
                    <td className="px-3 py-2 text-slate-600">{formatEnergy(row?.contractEnergy)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatEnergy(r.generation)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.incomeReceived)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.monthlyExpenditure)}</td>
                    <td className="px-3 py-2 text-slate-600">{formatCost(row?.sparePartPurchase)}</td>
                    {isAdmin && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end">
                          {r.bsMonth && (
                            <button
                              onClick={() => openEditForm(r.bsMonth!)}
                              className="flex items-center justify-center w-7 h-7 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2">{formatEnergy(totals.contractEnergy)}</td>
                <td className="px-3 py-2">{formatEnergy(totals.actualGeneration)}</td>
                <td className="px-3 py-2">{formatCost(totals.incomeReceived)}</td>
                <td className="px-3 py-2">{formatCost(totals.monthlyExpenditure)}</td>
                <td className="px-3 py-2">{formatCost(totals.sparePartPurchase)}</td>
                {isAdmin && <td className="px-3 py-2" />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit modal (financial fields only — Actual Generation is derived from the daily grid above) */}
      {editingMonth !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="text-[14px] font-semibold text-slate-900">
                {dateFormat === "bs"
                  ? `${bsMonthLabel(year, editingMonth - 1)} ${year}`
                  : bsMonthAdLabel(year, editingMonth - 1)}
              </h3>
              <button onClick={closeForm} className="p-1 rounded hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              {formError && (
                <div className="px-3 py-2 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded">
                  {formError}
                </div>
              )}
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">
                  Contract energy (kWh)
                </label>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={form.contractEnergy}
                  onChange={(e) => setForm({ ...form, contractEnergy: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block mb-1 text-[11px] font-medium text-slate-500">
                  Income received
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={form.incomeReceived}
                  onChange={(e) => setForm({ ...form, incomeReceived: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Monthly expenditure
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.monthlyExpenditure}
                    onChange={(e) => setForm({ ...form, monthlyExpenditure: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[11px] font-medium text-slate-500">
                    Spare part purchase
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.sparePartPurchase}
                    onChange={(e) => setForm({ ...form, sparePartPurchase: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-[12px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        isLoading={deleteDailyMutation.isPending}
        title="Delete Daily Entries"
        message={
          deleteTarget && deleteTarget.length === 1
            ? `Delete the daily generation entry for ${dateLabel(deleteTarget[0])}? This can't be undone.`
            : `Delete ${deleteTarget?.length ?? 0} daily generation entries? This can't be undone.`
        }
      />
    </div>
  );
};

export default ProjectPerformanceTab;
