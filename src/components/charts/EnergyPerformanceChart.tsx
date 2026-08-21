import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type EnergyChartPoint = { label: string; value: number | null; target: number | null };

/** Energy Performance trend chart — actual generation vs. contracted target,
 * either per-day (one month) or per-month (one year). A stat strip (total,
 * average, % of target) sits above the SVG; navigation is fully controlled
 * by the parent so it stays in sync with the entry grid below it. */
const EnergyPerformanceChart: React.FC<{
  data: EnergyChartPoint[];
  navigatorLabel: string;
  onNavigate: (dir: -1 | 1) => void;
  color?: string;
  height?: number;
}> = ({ data, navigatorLabel, onNavigate, color = "#2563EB", height = 220 }) => {
  const values = data.filter((d) => d.value !== null).map((d) => d.value as number);
  const total = values.reduce((a, b) => a + b, 0);
  const average = values.length ? total / values.length : 0;
  const targetTotal = data.reduce((acc, d) => acc + (d.target ?? 0), 0);
  const pctOfTarget = targetTotal > 0 ? (total / targetTotal) * 100 : null;

  const width = Math.max(320, data.length * 48);
  const padding = { top: 16, right: 16, bottom: 28, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const allValues = data.flatMap((d) => [d.value, d.target]).filter((v): v is number => v !== null);
  const max = Math.max(...allValues, 0);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const yFor = (v: number) => padding.top + chartH - ((v - min) / range) * chartH;

  // Fixed, non-scrolling y-axis (left of the horizontally-scrollable plot) so
  // the scale stays visible regardless of how far the data is scrolled.
  const yAxisWidth = 48;
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => min + (range * i) / tickCount).reverse();
  const formatTick = (v: number) =>
    Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : Math.round(v).toLocaleString();

  const points = data.map((d, i) => ({ x: padding.left + i * stepX, ...d }));
  const valuePoints = points.filter((p) => p.value !== null) as (typeof points[number] & { value: number })[];
  const linePath = valuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${yFor(p.value)}`).join(" ");
  const targetPoints = points.filter((p) => p.target !== null) as (typeof points[number] & { target: number })[];
  const targetPath = targetPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${yFor(p.target)}`).join(" ");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-[11px] text-slate-400">Total</p>
            <p className="text-[15px] font-semibold text-slate-900">{total.toLocaleString()} kWh</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Average</p>
            <p className="text-[15px] font-semibold text-slate-900">
              {average.toLocaleString(undefined, { maximumFractionDigits: 1 })} kWh
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">% of Target</p>
            <p className="text-[15px] font-semibold text-slate-900">
              {pctOfTarget === null ? "--" : `${pctOfTarget.toFixed(1)}%`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(-1)}
            className="flex items-center justify-center w-7 h-7 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="w-28 text-center text-[13px] font-semibold text-slate-900">{navigatorLabel}</span>
          <button
            onClick={() => onNavigate(1)}
            className="flex items-center justify-center w-7 h-7 transition-colors border rounded-lg text-slate-500 border-slate-200 hover:bg-slate-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-[12px] text-slate-400">No data for this range.</p>
      ) : (
        <div className="flex">
          <svg width={yAxisWidth} height={height} className="flex-shrink-0">
            {ticks.map((t, i) => (
              <text
                key={i}
                x={yAxisWidth - 6}
                y={yFor(t)}
                dy={3}
                textAnchor="end"
                className="fill-slate-400"
                style={{ fontSize: 10 }}
              >
                {formatTick(t)}
              </text>
            ))}
          </svg>
          <div className="overflow-x-auto">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
              {ticks.map((t, i) => (
                <line
                  key={i}
                  x1={padding.left}
                  y1={yFor(t)}
                  x2={width - padding.right}
                  y2={yFor(t)}
                  stroke="#F1F5F9"
                  strokeWidth={1}
                />
              ))}
              {targetPath && (
                <path
                  d={targetPath}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {linePath && (
                <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {valuePoints.map((p) => (
                <g key={p.label}>
                  <circle cx={p.x} cy={yFor(p.value)} r={3.5} fill="#fff" stroke={color} strokeWidth={2}>
                    <title>
                      {p.label}: {p.value.toLocaleString()} kWh
                      {p.target !== null ? ` (target ${p.target.toLocaleString()} kWh)` : ""}
                    </title>
                  </circle>
                </g>
              ))}
              {points.map((p) => (
                <text
                  key={`${p.label}-axis`}
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-400"
                  style={{ fontSize: 10 }}
                >
                  {p.label}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnergyPerformanceChart;
