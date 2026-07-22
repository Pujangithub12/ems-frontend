import React from "react";

function polarPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Donut chart — categorical identity encoding, fixed caller-assigned colors, legend + value/percent labels so color is never the only cue. */
const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  formatValue?: (v: number) => string;
}> = ({ data, formatValue = (v) => String(v) }) => {
  const size = 220;
  const radius = 88;
  const innerRadius = 52;
  const cx = size / 2;
  const cy = size / 2;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let cumulative = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = total > 0 ? d.value / total : 0;
      const startAngle = cumulative * 360;
      cumulative += fraction;
      const endAngle = cumulative * 360;
      return { ...d, fraction, startAngle, endAngle };
    });

  const arcPath = (startAngle: number, endAngle: number) => {
    const outerStart = polarPoint(cx, cy, radius, endAngle);
    const outerEnd = polarPoint(cx, cy, radius, startAngle);
    const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
    const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
      "Z",
    ].join(" ");
  };

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {total <= 0 ? (
            <circle cx={cx} cy={cy} r={radius} fill="#F1F5F9" />
          ) : slices.length === 1 ? (
            <>
              <circle cx={cx} cy={cy} r={radius} fill={slices[0].color} />
              <circle cx={cx} cy={cy} r={innerRadius} fill="#fff" />
            </>
          ) : (
            slices.map((s) => (
              <path key={s.label} d={arcPath(s.startAngle, s.endAngle)} fill={s.color} stroke="#fff" strokeWidth={2}>
                <title>
                  {s.label}: {formatValue(s.value)} ({Math.round(s.fraction * 100)}%)
                </title>
              </path>
            ))
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-slate-400">Total</span>
          <span className="text-[15px] font-bold text-slate-900">{formatValue(total)}</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="flex-shrink-0 w-3 h-3 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-700">{d.label}</span>
            <span className="text-slate-400">
              {formatValue(d.value)}
              {total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
