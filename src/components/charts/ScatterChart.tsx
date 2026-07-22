import React from "react";

/** Scatter chart — X/Y magnitude per point, bubble size = a third magnitude (volume). Single series, so no legend needed beyond axis labels. */
const ScatterChart: React.FC<{
  data: { label: string; x: number; y: number; size: number }[];
  xLabel: string;
  yLabel: string;
  formatSize?: (v: number) => string;
  color?: string;
}> = ({ data, xLabel, yLabel, formatSize = (v) => String(v), color = "#2563EB" }) => {
  if (data.length === 0) {
    return <p className="text-[12px] text-slate-400">No vendors with enough data yet.</p>;
  }
  const width = 360;
  const height = 240;
  const padding = { top: 12, right: 16, bottom: 34, left: 34 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const sizes = data.map((d) => d.size);
  const xMax = Math.max(1, ...xs);
  const yMax = Math.max(5, ...ys);
  const sizeMax = Math.max(1, ...sizes);

  const scaleX = (v: number) => padding.left + (v / xMax) * chartW;
  const scaleY = (v: number) => padding.top + chartH - (v / yMax) * chartH;
  const scaleR = (v: number) => 5 + (v / sizeMax) * 14;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="#E2E8F0" />
      <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="#E2E8F0" />
      <text x={padding.left + chartW / 2} y={height - 6} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 10 }}>
        {xLabel}
      </text>
      <text
        x={-(padding.top + chartH / 2)}
        y={10}
        textAnchor="middle"
        transform="rotate(-90)"
        className="fill-slate-400"
        style={{ fontSize: 10 }}
      >
        {yLabel}
      </text>
      {data.map((d) => (
        <circle
          key={d.label}
          cx={scaleX(d.x)}
          cy={scaleY(d.y)}
          r={scaleR(d.size)}
          fill={color}
          fillOpacity={0.55}
          stroke={color}
          strokeWidth={1.5}
        >
          <title>
            {d.label}: {yLabel} {d.y}, {xLabel} {d.x.toFixed(1)}, volume {formatSize(d.size)}
          </title>
        </circle>
      ))}
    </svg>
  );
};

export default ScatterChart;
