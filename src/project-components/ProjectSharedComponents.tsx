import React from "react";

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

export const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "#FEF3C7", fg: "#B45309", label: "Pending" },
    in_progress: { bg: "#DBEAFE", fg: "#1E3A8A", label: "Active" },
    on_hold: { bg: "#FEE2E2", fg: "#B91C1C", label: "On Hold" },
    completed: { bg: "#DCFCE7", fg: "#15803D", label: "Completed" },
  };
  const s = styles[status] || { bg: "#EEF1F5", fg: "#475569", label: status };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: s.bg,
        color: s.fg,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {s.label}
    </span>
  );
};
