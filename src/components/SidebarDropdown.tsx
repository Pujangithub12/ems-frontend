import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";

export interface SidebarDropdownItem {
  to: string;
  label: string;
}

export interface SidebarDropdownProps {
  icon: React.ElementType;
  label: string;
  items: SidebarDropdownItem[];
  onNavigate?: () => void;
}

/** A collapsible sidebar group (e.g. "Purchase" -> Purchase Order / Goods Received), styled to match SidebarLink. */
const SidebarDropdown: React.FC<SidebarDropdownProps> = ({ icon: Icon, label, items, onNavigate }) => {
  const location = useLocation();
  const isChildActive = items.some((it) => location.pathname === it.to);
  const [open, setOpen] = React.useState(isChildActive);

  // Auto-expand if the user navigates directly to a child route (e.g. via a bookmark).
  React.useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative w-full flex items-center gap-2.5 pl-2.5 pr-2.5 py-2 rounded-lg text-left text-[14.5px] transition-colors ${
          isChildActive
            ? "bg-white/10 text-white font-medium shadow-sm ring-1 ring-white/10"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-blue-400 transition-opacity ${
            isChildActive ? "opacity-100" : "opacity-0"
          }`}
        />
        <Icon className={`w-3.5 h-3.5 ${isChildActive ? "opacity-100 text-blue-400" : "opacity-70"}`} />
        <span className="flex-1">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-0.5 ml-[13px] pl-[13px] border-l border-slate-800 flex flex-col gap-0.5">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center py-1.5 px-2.5 rounded-lg text-[13.5px] transition-colors ${
                  isActive
                    ? "bg-white/10 text-white font-medium"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarDropdown;
