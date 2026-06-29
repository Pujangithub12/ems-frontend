import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    className="text-[10px] tracking-[0.1em] uppercase text-slate-400 px-3 pt-2.5 pb-1.5"
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

const WorkspaceSwitcher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Mock list of companies/workspaces
  const workspaces = [
    { id: 1, name: "Lumbini Energy", sub: "Solar IPP · 8 people" },
    { id: 2, name: "Trishuli Hydro Group", sub: "Hydropower IPP · 22 people" },
  ];

  const handleSwitch = (id: number) => {
    // TODO: Implement your actual workspace switching logic here
    // (e.g., update context, change tenant ID, redirect)
    console.log("Switched to workspace ID:", id);
    setOpen(false);
  };

  const handleAdd = () => {
    // TODO: Implement add workspace logic (e.g., open a modal)
    console.log("Add workspace clicked");
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 hover:bg-slate-200/60 rounded px-2.5 py-2.5 text-left transition-colors"
      >
        <div className="w-[26px] h-[26px] bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[10px] tracking-[0.05em] flex-shrink-0">
          EM
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold tracking-tight leading-tight truncate text-[14px] text-slate-900">
            EMS Workspace
          </div>
          <div
            className="text-[9px] text-slate-400 tracking-[0.08em] uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Management
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Dropdown Popup */}
      {open && (
        <div
          className="absolute left-0 top-[calc(100% + 6px)] w-full bg-white rounded-md border border-slate-200 z-50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ minWidth: 228 }}
        >
          {/* Current Workspace Section */}
          <Eyebrow>Current workspace</Eyebrow>
          <div className="px-3 py-2 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-900 rounded flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
              EM
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-[13px] text-slate-900">
                EMS Workspace
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Management · 14 people
              </div>
            </div>
            <Check className="flex-shrink-0 w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-px my-1 bg-slate-200" />

          {/* Switch Workspace Section */}
          <Eyebrow>Switch workspace</Eyebrow>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              className="flex items-center w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100"
            >
              <div className="w-6 h-6 bg-slate-200 rounded flex items-center justify-center text-slate-600 font-bold text-[9px] flex-shrink-0">
                {ws.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-900 truncate">
                  {ws.name}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {ws.sub}
                </div>
              </div>
            </button>
          ))}

          <div className="h-px my-1 bg-slate-200" />

          {/* Add Workspace Section */}
          <button
            onClick={handleAdd}
            className="flex items-center w-full gap-3 px-3 py-2 text-left transition-colors hover:bg-slate-100"
          >
            <div className="flex items-center justify-center flex-shrink-0 w-6 h-6 rounded bg-slate-100 text-slate-500">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <div className="text-[13px] font-medium text-slate-900">
              Add workspace
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
