import React from "react";
import type { LucideIcon } from "lucide-react";

/** Shared small metric tile — label, big bold value, muted sub-line, and a
 * plain colored icon in the corner. Used on the Dashboard's KPI strip and
 * Site Activities' weekly summary. Renders as a `<button>` when `onClick` is
 * given (KPI cards that navigate somewhere), otherwise a plain `<div>`
 * (read-only stats). */
const StatCard: React.FC<{
  accent: string;
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconText?: string;
  onClick?: () => void;
}> = ({ label, value, sub, icon: Icon, iconText = "text-slate-400", onClick }) => {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-slate-500 truncate">{label}</p>
        {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconText}`} strokeWidth={2} />}
      </div>
      <p className="mt-1.5 text-[21px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-slate-400">{sub}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="p-3.5 text-left transition-colors bg-white border rounded-xl border-slate-200 hover:border-slate-300 hover:shadow-sm"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="p-3.5 bg-white border rounded-xl border-slate-200">
      {content}
    </div>
  );
};

export default StatCard;