import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * Generic right-side slide-over panel. Visual/z-index/overlay convention
 * matches OrgTree.tsx's inline PersonDrawer, generalized into a reusable
 * component with a slide-in transition.
 */
const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: number;
}> = ({ open, onClose, title, subtitle, children, width = 440 }) => {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!mounted) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/45 transition-opacity duration-200"
        style={{ zIndex: 39, opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className="fixed inset-y-0 right-0 flex flex-col bg-white border-l border-slate-200 transition-transform duration-200 ease-out"
        style={{
          width,
          maxWidth: "100vw",
          zIndex: 40,
          boxShadow: "-12px 0 40px rgba(0,0,0,0.08)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 truncate">{title}</h2>
            {subtitle && <p className="text-[12px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </>
  );
};

export const DrawerSection: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <div className="p-5 border-b border-slate-100 last:border-0">
    <div className="flex items-center justify-between mb-3">
      <span
        className="text-[10px] tracking-[0.1em] uppercase text-slate-400"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {title}
      </span>
      {action}
    </div>
    {children}
  </div>
);

export const DrawerRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[13px]">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-right ml-3 truncate text-slate-900">{children}</span>
  </div>
);

export default Drawer;
