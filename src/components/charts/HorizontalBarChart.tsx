import React from "react";

/** Horizontal bar chart — single series magnitude, direct value labels, sorted by caller. */
const HorizontalBarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
  color?: string;
}> = ({ data, formatValue = (v) => String(v), color = "#2563EB" }) => {
  if (data.length === 0) {
    return <p className="text-[12px] text-slate-400">No data yet.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-32 text-[11.5px] text-slate-600 truncate flex-shrink-0" title={d.label}>
            {d.label}
          </span>
          <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: d.color || color }}
            />
          </div>
          <span className="w-20 text-[11.5px] font-medium text-right text-slate-700 flex-shrink-0">
            {formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default HorizontalBarChart;
