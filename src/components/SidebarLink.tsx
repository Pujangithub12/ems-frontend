import React from "react";
import { NavLink } from "react-router-dom";

export interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

/** A single sidebar navigation entry; highlights itself via react-router's NavLink instead of manual pathname comparison. */
const SidebarLink: React.FC<SidebarLinkProps> = ({
  to,
  icon: Icon,
  label,
  onClick,
}) => (
  <NavLink
    to={to}
    end
    onClick={onClick}
    className={({ isActive }) =>
      `w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 rounded text-left text-[14.5px] transition-colors ${
        isActive
          ? "bg-slate-800 text-white font-medium"
          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
      }`
    }
  >
    <Icon className="w-3.5 h-3.5 opacity-70" />
    <span>{label}</span>
  </NavLink>
);

export default SidebarLink;
