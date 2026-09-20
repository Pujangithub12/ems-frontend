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
  Zap,
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
import ProjectPerformanceTab from "../../projects/components/tabs/ProjectPerformanceTab";
import { useDailyGenerationQuery } from "../../projects/hooks/useMonthlyPerformance";
import { toNumber } from "../../../lib/currency";
import { getErrorMessage } from "../../../lib/errors";
import { adDateForBsDay } from "../../../lib/bsDate";
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
import { TableSheet, TableNameModal, inputCls, getPeriodKey, type Granularity } from "../../customTables/components/TableSheet";

const CHART_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];


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

/** Fixed pseudo-columns standing in for Energy Performance's Daily Generation data, which
 * (unlike everything else in this tab) doesn't come from a user-defined PlantReportTable —
 * negative ids so they can never collide with a real PlantReportColumn's autoincrement id,
 * letting the rest of this component's selection/rendering logic treat them identically. */
const ENERGY_PERFORMANCE_SOURCE = "energyPerformance" as const;
const ENERGY_PERFORMANCE_COLUMNS: { id: number; name: string; dataType: "number"; target: null }[] = [
  { id: -1, name: "Check Meter Initial Reading", dataType: "number", target: null },
  { id: -2, name: "Check Meter Final Reading", dataType: "number", target: null },
  { id: -3, name: "Check Meter Difference", dataType: "number", target: null },
  { id: -4, name: "Main Meter Initial Reading", dataType: "number", target: null },
  { id: -5, name: "Main Meter Final Reading", dataType: "number", target: null },
  { id: -6, name: "Main Meter Difference", dataType: "number", target: null },
  { id: -7, name: "Generation (Actual)", dataType: "number", target: null },
];
// Wide enough to cover essentially any real project's data without needing a year/date picker
// in this tab (which, unlike the Energy Performance tab itself, charts everything at once).
const ENERGY_PERFORMANCE_RANGE = { startDate: "2015-01-01", endDate: "2035-01-01" };

const ChartsTab: React.FC<{ tables: PlantReportTable[]; projectId: number | "" }> = ({ tables, projectId }) => {
  const [selectedTableId, setSelectedTableId] = useState<number | typeof ENERGY_PERFORMANCE_SOURCE | "">(
    tables[0]?.id ?? ENERGY_PERFORMANCE_SOURCE,
  );
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [xColumnId, setXColumnId] = useState<number | "">("");
  const [yColumnIds, setYColumnIds] = useState<number[]>([]);
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const isEnergyPerformance = selectedTableId === ENERGY_PERFORMANCE_SOURCE;
  const plantTableId = typeof selectedTableId === "number" ? selectedTableId : null;
  const { data, isLoading: tableLoading } = usePlantReportTableDetail(plantTableId);
  const { data: dailyGenerationRows = [], isLoading: dailyLoading } = useDailyGenerationQuery(
    isEnergyPerformance && projectId ? String(projectId) : "",
    ENERGY_PERFORMANCE_RANGE.startDate,
    ENERGY_PERFORMANCE_RANGE.endDate,
  );
  const isLoading = isEnergyPerformance ? dailyLoading : tableLoading;
  const columns = data?.columns ?? [];
  const numberColumns = useMemo(
    () => (isEnergyPerformance ? ENERGY_PERFORMANCE_COLUMNS : columns.filter((c) => c.dataType === "number")),
    [isEnergyPerformance, columns],
  );

  useEffect(() => {
    if (isEnergyPerformance) {
      setXColumnId("");
      setYColumnIds(ENERGY_PERFORMANCE_COLUMNS.slice(0, 3).map((c) => c.id));
    } else {
      setXColumnId(columns[0]?.id ?? "");
      setYColumnIds(numberColumns.slice(0, 3).map((c) => c.id));
    }
    setGranularity("daily");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTableId]);

  const xColumn = columns.find((c) => c.id === xColumnId) ?? null;
  const canGroupByPeriod = isEnergyPerformance || xColumn?.dataType === "date";

  useEffect(() => {
    if (!canGroupByPeriod) setGranularity("daily");
  }, [canGroupByPeriod]);

  const chartData = useMemo(() => {
    if (isEnergyPerformance) {
      const dailyPoints = dailyGenerationRows.map((row) => ({
        date: new Date(`${row.date}T00:00:00`),
        values: {
          [-1]: toNumber(row.checkMeterInitial),
          [-2]: toNumber(row.checkMeterFinal),
          [-3]: toNumber(row.checkMeterDifference),
          [-4]: toNumber(row.mainMeterInitial),
          [-5]: toNumber(row.mainMeterFinal),
          [-6]: toNumber(row.mainMeterDifference),
          [-7]: toNumber(row.generation),
        } as Record<number, number | null>,
      }));

      if (granularity === "daily") {
        return dailyPoints.map((p) => {
          const point: Record<string, string | number | null> = { x: formatXValue(p.date.toISOString().slice(0, 10), "date") };
          for (const col of ENERGY_PERFORMANCE_COLUMNS) point[String(col.id)] = p.values[col.id];
          return point;
        });
      }

      const buckets = new Map<string, { key: string; label: string; sums: Record<number, number> }>();
      for (const p of dailyPoints) {
        const { key, label } = getPeriodKey(p.date, granularity);
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { key, label, sums: {} };
          buckets.set(key, bucket);
        }
        for (const col of ENERGY_PERFORMANCE_COLUMNS) {
          const v = p.values[col.id];
          if (v != null) bucket.sums[col.id] = (bucket.sums[col.id] ?? 0) + v;
        }
      }
      return [...buckets.values()]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((b) => {
          const point: Record<string, string | number | null> = { x: b.label };
          for (const col of ENERGY_PERFORMANCE_COLUMNS) point[String(col.id)] = b.sums[col.id] ?? null;
          return point;
        });
    }

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
  }, [isEnergyPerformance, dailyGenerationRows, data, xColumn, numberColumns, granularity]);

  const toggleYColumn = (id: number) => {
    setYColumnIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="px-6 py-5">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select
          value={selectedTableId}
          onChange={(e) =>
            setSelectedTableId(e.target.value === ENERGY_PERFORMANCE_SOURCE ? ENERGY_PERFORMANCE_SOURCE : Number(e.target.value))
          }
          className={inputCls}
          style={{ width: 220 }}
        >
          <option value={ENERGY_PERFORMANCE_SOURCE}>⚡ Energy Performance</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {!isEnergyPerformance && (
          <select value={xColumnId} onChange={(e) => setXColumnId(Number(e.target.value))} className={inputCls} style={{ width: 160 }}>
            <option value="">X axis: (none)</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                X: {c.name}
              </option>
            ))}
          </select>
        )}
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
  const [activeTabId, setActiveTabId] = useState<number | "charts" | "energyPerformance" | "">("");
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

  // Fed into the shared <TableSheet> below as plain data/callback props — see
  // frontend/src/features/customTables/components/TableSheet.tsx, which owns
  // no data-fetching of its own so it can be reused by both this page and Materials.
  const activeTableId = typeof activeTabId === "number" ? activeTabId : null;
  const tableDetailQuery = usePlantReportTableDetail(activeTableId);
  const createColumnMutation = useCreatePlantReportColumn();
  const updateColumnMutation = useUpdatePlantReportColumn();
  const deleteColumnMutation = useDeletePlantReportColumn();
  const createRowMutation = useCreatePlantReportRow();
  const updateRowMutation = useUpdatePlantReportRow();
  const deleteRowMutation = useDeletePlantReportRow();
  const importSheetMutation = useImportPlantReportSheet();

  useEffect(() => {
    if (
      tables.length > 0 &&
      (activeTabId === "" ||
        (activeTabId !== "charts" && activeTabId !== "energyPerformance" && !tables.some((t) => t.id === activeTabId)))
    ) {
      setActiveTabId(tables[0].id);
    }
  }, [tables, activeTabId]);

  const activeTable = activeTabId !== "charts" && activeTabId !== "energyPerformance" ? tables.find((t) => t.id === activeTabId) : null;
  const currentProject = projects.find((p) => p.id === projectId) ?? null;

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
          onClick={() => setActiveTabId("energyPerformance")}
          className={`flex items-center gap-1.5 px-4 py-3 text-[13px] border-b-2 whitespace-nowrap transition-colors ${
            activeTabId === "energyPerformance" ? "border-slate-900 text-black font-semibold" : "border-transparent font-medium text-slate-500 hover:text-slate-700"
          }`}
        >
          <Zap size={14} className="opacity-70" /> Energy Performance
        </button>

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
        <ChartsTab tables={tables} projectId={projectId} />
      ) : activeTabId === "energyPerformance" ? (
        currentProject && (
          <div className="p-6">
            <ProjectPerformanceTab project={currentProject} hideChart hideMonthlySummary />
          </div>
        )
      ) : activeTable ? (
        <TableSheet
          key={activeTable.id}
          tableId={activeTable.id}
          isAdmin={isAdmin}
          tableName={activeTable.name}
          locked={activeTable.isDefault}
          detail={tableDetailQuery.data}
          isLoading={tableDetailQuery.isLoading}
          isError={tableDetailQuery.isError}
          errorMessage={getErrorMessage(tableDetailQuery.error, "Failed to load table.")}
          onCreateColumn={(payload) => createColumnMutation.mutateAsync({ tableId: activeTable.id, payload })}
          onUpdateColumn={(id, payload) => updateColumnMutation.mutateAsync({ id, tableId: activeTable.id, payload })}
          onDeleteColumn={(id) => deleteColumnMutation.mutateAsync({ id, tableId: activeTable.id })}
          onCreateRow={(payload) => createRowMutation.mutateAsync({ tableId: activeTable.id, payload })}
          onUpdateRow={(id, payload) => updateRowMutation.mutateAsync({ id, tableId: activeTable.id, payload })}
          onDeleteRow={(id) => deleteRowMutation.mutateAsync({ id, tableId: activeTable.id })}
          onImportSheet={(payload) => importSheetMutation.mutateAsync({ tableId: activeTable.id, payload })}
        />
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