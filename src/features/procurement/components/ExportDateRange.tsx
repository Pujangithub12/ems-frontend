import React, { useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar day as YYYY-MM-DD. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fmtExportDay = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
export const fmtExportDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Preset = { key: string; label: string; range: () => [string, string] };
const PRESETS: Preset[] = [
  { key: "all", label: "All time", range: () => ["", ""] },
  {
    key: "this_month",
    label: "This month",
    range: () => {
      const n = new Date();
      return [isoDay(new Date(n.getFullYear(), n.getMonth(), 1)), isoDay(new Date(n.getFullYear(), n.getMonth() + 1, 0))];
    },
  },
  {
    key: "last_month",
    label: "Last month",
    range: () => {
      const n = new Date();
      return [isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoDay(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
  },
  {
    key: "last_3",
    label: "Last 3 months",
    range: () => {
      const n = new Date();
      return [isoDay(new Date(n.getFullYear(), n.getMonth() - 2, 1)), isoDay(n)];
    },
  },
  {
    key: "this_year",
    label: "This year",
    range: () => {
      const n = new Date();
      return [`${n.getFullYear()}-01-01`, `${n.getFullYear()}-12-31`];
    },
  },
];

/** From/To state for an export popup. `inRange` takes a YYYY-MM-DD day. */
export function useExportDateRange() {
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalid = !!from && !!to && from > to;
  const inRange = (day: string) => (!from || day >= from) && (!to || day <= to);
  const fileSuffix = from || to ? `-${from || "start"}-to-${to || "today"}` : "";
  return { preset, setPreset, from, setFrom, to, setTo, invalid, inRange, fileSuffix };
}

/** Preset chips + From/To inputs, shared by the export popups. */
export const ExportDateRange: React.FC<{ state: ReturnType<typeof useExportDateRange>; hint: string }> = ({ state, hint }) => {
  const inputCls =
    "w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";
  return (
    <div>
      <label className="block mb-2 text-[12px] font-medium text-slate-600">Date range</label>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              const [f, t] = p.range();
              state.setPreset(p.key);
              state.setFrom(f);
              state.setTo(t);
            }}
            className={`px-2.5 py-1 text-[12px] font-medium rounded-full border transition-colors ${
              state.preset === p.key ? "bg-blue-900 border-blue-900 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block mb-1 text-[11px] text-slate-400">From</span>
          <input
            type="date"
            value={state.from}
            onChange={(e) => {
              state.setFrom(e.target.value);
              state.setPreset("custom");
            }}
            className={inputCls}
          />
        </div>
        <div>
          <span className="block mb-1 text-[11px] text-slate-400">To</span>
          <input
            type="date"
            value={state.to}
            onChange={(e) => {
              state.setTo(e.target.value);
              state.setPreset("custom");
            }}
            className={inputCls}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>
      {state.invalid && <p className="mt-1 text-[11px] text-red-600">"From" is after "To".</p>}
    </div>
  );
};
