import React from "react";

/** Tiny inline trend line for a KPI card — no axes, no legend (a single series needs none). */
const Sparkline: React.FC<{ data: { value: number }[]; color?: string; width?: number; height?: number }> = ({
  data,
  color = "#2563EB",
  width = 88,
  height = 28,
}) => {
  if (data.length < 2) return <div style={{ width, height }} />;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

export default Sparkline;
