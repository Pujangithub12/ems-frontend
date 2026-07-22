import React from "react";

/** Single-series line chart (magnitude over time) — one hue, recessive grid, hover dots with a native tooltip. */
const LineChart: React.FC<{
  data: { label: string; value: number }[];
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
}> = ({ data, color = "#2563EB", formatValue = (v) => String(v), height = 200 }) => {
  if (data.length === 0) {
    return <p className="text-[12px] text-slate-400">No data for this range.</p>;
  }
  const width = Math.max(320, data.length * 64);
  const padding = { top: 16, right: 16, bottom: 28, left: 8 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - ((d.value - min) / range) * chartH,
    ...d,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const zeroY = padding.top + chartH - ((0 - min) / range) * chartH;

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="#E2E8F0" strokeWidth={1} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2}>
              <title>
                {p.label}: {formatValue(p.value)}
              </title>
            </circle>
            <text x={p.x} y={height - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default LineChart;
