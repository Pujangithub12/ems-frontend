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
      `w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 rounded text-left text-[14.5px] transition-colors ${
        isActive
          ? "bg-slate-800 text-white font-medium"
          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
      }`
    }
  >
    <Icon className="w-3.5 h-3.5 opacity-70" />
    <span className="flex-1">{label}</span>
    {!!badgeCount && badgeCount > 0 && (
      <span
        className="flex items-center justify-center flex-shrink-0 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-red-600 rounded-full"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {badgeCount > 99 ? "99+" : badgeCount}
      </span>
    )}
  </NavLink>
);

export default SidebarLink;
