import React from "react";
import { CheckCircle2, Clock, Flag, PauseCircle } from "lucide-react";

/** Shared formatting/status-styling helpers + small presentational pieces
 * used identically across AssignedTasks/MyTasks/CompletedTasks (and the
 * Task Details drawers within them) — centralized here instead of each page
 * carrying its own byte-for-byte copy. */

export const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const formatLongDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

export const getStatusMeta = (status: string) => {
  const v = status.toLowerCase().replace(/\s+/g, "_");
  if (v === "completed")
    return { label: "Completed", bg: "#DCFCE7", fg: "#15803D", Icon: CheckCircle2 };
  if (v === "in_progress")
    return { label: "In Progress", bg: "#DBEAFE", fg: "#1E3A8A", Icon: Clock };
  if (v === "on_hold")
    return { label: "On Hold", bg: "#FEE2E2", fg: "#B91C1C", Icon: PauseCircle };
  return { label: "To Do", bg: "#FEF3C7", fg: "#B45309", Icon: Clock };
};

export const isOverdue = (dueDate: string, status: string) =>
  status !== "completed" &&
  new Date(dueDate).getTime() < new Date(new Date().toDateString()).getTime();

/** "3 days left" / "Due today" / "Overdue by 2 days" — mirrors dueDateInfo() in ProjectSharedComponents.tsx for consistent wording app-wide. */
export const daysRemainingLabel = (dueDate: string, status: string): string | null => {
  if (!dueDate || status === "completed") return null;
  const diffMs = new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  const days = Math.round(diffMs / 86400000);
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
};

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

/** Same look as Eyebrow, but a darker slate-600 for section headings that need more visual weight (Task Details/Update/Activity popups). */
export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <p
    className={`text-[10px] font-semibold tracking-[0.1em] uppercase text-slate-600 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </p>
);

export const StatusPill: React.FC<{ type: "priority" | "status"; value: string }> = ({
  type,
  value,
}) => {
  let bg = "#EEF1F5",
    fg = "#475569",
    label = value;
  const v = value.toLowerCase().replace(/\s+/g, "");
  if (type === "priority") {
    if (v === "high") {
      bg = "#FEE2E2";
      fg = "#B91C1C";
    } else if (v === "medium") {
      bg = "#FEF3C7";
      fg = "#B45309";
    } else if (v === "low") {
      bg = "#DCFCE7";
      fg = "#15803D";
    }
  } else {
    if (v === "completed") {
      bg = "#DCFCE7";
      fg = "#15803D";
    } else if (v === "inprogress" || v === "in_progress") {
      bg = "#DBEAFE";
      fg = "#1E3A8A";
    } else if (v === "to_do") {
      bg = "#FEF3C7";
      fg = "#B45309";
    } else if (v === "onhold" || v === "on_hold") {
      bg = "#FEE2E2";
      fg = "#B91C1C";
      label = "On Hold";
    }
  }
  if (type === "priority") {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] tracking-[0.05em] uppercase font-semibold"
        style={{ fontFamily: "'JetBrains Mono', monospace", color: fg }}
      >
        <Flag className="w-3 h-3" fill={fg} strokeWidth={1.5} />
        {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium ring-1 ring-inset"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: bg,
        color: fg,
        // @ts-expect-error -- CSS custom property used only to derive the ring color below
        "--tw-ring-color": `${fg}26`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: fg }} />
      {label}
    </span>
  );
};
