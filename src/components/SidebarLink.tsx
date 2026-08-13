import React from "react";
import { NavLink } from "react-router-dom";

export interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  /** Shows a red badge with this count (e.g. pending approvals/open tasks) when > 0. */
  badgeCount?: number;
}

/** A single sidebar navigation entry; highlights itself via react-router's NavLink instead of manual pathname comparison. */
const SidebarLink: React.FC<SidebarLinkProps> = ({
  to,
  icon: Icon,
  label,
  onClick,
  badgeCount,
}) => (
  <NavLink
    to={to}
    end
    onClick={onClick}
    className={({ isActive }) =>
      `relative w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 rounded-lg text-left text-[14.5px] transition-colors ${
        isActive
          ? "bg-white/10 text-white font-medium shadow-sm ring-1 ring-white/10"
          : "text-slate-300 hover:bg-white/5 hover:text-white"
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-400 transition-opacity ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon className={`w-3.5 h-3.5 ${isActive ? "opacity-100 text-blue-400" : "opacity-70"}`} />
        <span className="flex-1">{label}</span>
        {!!badgeCount && badgeCount > 0 && (
          <span
            className="flex items-center justify-center flex-shrink-0 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-red-600 rounded-full shadow-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </>
    )}
  </NavLink>
);

export default SidebarLink;
