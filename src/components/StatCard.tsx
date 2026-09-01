import React from "react";
import type { LucideIcon } from "lucide-react";

/** Shared small metric tile — a colored left accent border, label, big bold
 * value, and a muted sub-line underneath, with an optional icon chip in the
 * top-right corner. Originally the Site Activities page's card; reused on
 * the Dashboard's KPI strip so both share one design language instead of
 * two different card styles. Renders as a `<button>` when `onClick` is
 * given (KPI cards that navigate somewhere), otherwise a plain `<div>`
 * (read-only stats, e.g. Site Activities' weekly summary). */
const StatCard: React.FC<{
  accent: string;
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconBg?: string;
  iconText?: string;
  onClick?: () => void;
}> = ({ accent, label, value, sub, icon: Icon, iconBg = "bg-slate-100", iconText = "text-slate-600", onClick }) => {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] text-slate-500">{label}</p>
        {Icon && (
          <div className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ring-1 ring-black/5 ${iconBg}`}>
            <Icon className={`w-3.5 h-3.5 ${iconText}`} />
          </div>
        )}
      </div>
      <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1.5 text-[11.5px] text-slate-400">{sub}</p>}
    </>
  );
  const style: React.CSSProperties = { borderLeft: `4px solid ${accent}` };

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="p-4 text-left transition-shadow bg-white border rounded-xl border-slate-200 hover:shadow-md"
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="p-4 bg-white border rounded-xl border-slate-200" style={style}>
      {content}
    </div>
  );
};

export default StatCard;
