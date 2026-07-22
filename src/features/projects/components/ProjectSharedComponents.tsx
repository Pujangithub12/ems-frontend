import React from "react";
import { Flag } from "lucide-react";

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

export const PriorityPill: React.FC<{ priority?: string }> = ({ priority }) => {
  const styles: Record<string, { fg: string; label: string }> = {
    high: { fg: "#B91C1C", label: "High" },
    medium: { fg: "#B45309", label: "Medium" },
    low: { fg: "#64748B", label: "Low" },
  };
  const p = styles[priority || "medium"] || styles.medium;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: p.fg }}
    >
      <Flag className="w-3 h-3" fill={p.fg} strokeWidth={1.5} />
      {p.label}
    </span>
  );
};

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dueDateInfo(dueDate?: string | null): { label: string; tone: string } | null {
  if (!dueDate) return null;
  const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const days = Math.round(diffMs / 86400000);
  if (days < 0) {
    return {
      label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`,
      tone: "text-red-600",
    };
  }
  if (days === 0) return { label: "Due today", tone: "text-amber-600" };
  return { label: `${days} day${days === 1 ? "" : "s"} remaining`, tone: "text-slate-500" };
}
