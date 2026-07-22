import React from "react";

/** Vertical stacked bar chart — composition across a fixed set of series per group, with a shared legend. */
const StackedBarChart: React.FC<{
  data: { group: string; values: Record<string, number> }[];
  series: { key: string; label: string; color: string }[];
  formatValue?: (v: number) => string;
  height?: number;
}> = ({ data, series, formatValue = (v) => String(v), height = 200 }) => {
  if (data.length === 0) {
    return <p className="text-[12px] text-slate-400">No data yet.</p>;
  }
  const totals = data.map((d) => series.reduce((s, ser) => s + (d.values[ser.key] || 0), 0));
  const max = Math.max(1, ...totals);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4" style={{ height }}>
        {data.map((d) => {
          const total = series.reduce((s, ser) => s + (d.values[ser.key] || 0), 0);
          return (
            <div key={d.group} className="flex flex-col items-center flex-1 h-full min-w-0">
              <div className="flex flex-col-reverse justify-start w-full h-full max-w-[56px] mx-auto gap-px">
                {series.map((ser) => {
                  const value = d.values[ser.key] || 0;
                  const segHeight = max > 0 ? (value / max) * (height - 24) : 0;
                  if (value <= 0) return null;
                  return (
                    <div key={ser.key} style={{ height: Math.max(2, segHeight), background: ser.color }} className="w-full first:rounded-b last:rounded-t">
                      <title>{`${ser.label}: ${formatValue(value)}`}</title>
                    </div>
                  );
                })}
              </div>
              <span className="w-full mt-2 text-[10px] text-center truncate text-slate-500" title={d.group}>
                {d.group}
              </span>
              <span className="text-[10px] text-slate-400">{formatValue(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {series.map((ser) => (
          <div key={ser.key} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: ser.color }} />
            {ser.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StackedBarChart;
