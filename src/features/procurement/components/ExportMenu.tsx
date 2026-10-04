import React, { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

/** "Export" button with a small dropdown choosing Excel vs. PDF — used above the Cost Breakdown
 * and Shipment Tracking tables on the Finance cost-breakdown page. Excel is built client-side
 * (see each caller's onExportExcel), PDF is rendered server-side for a professional report
 * layout and handed back here as a blob to download (see onExportPdf). */
const ExportMenu: React.FC<{ onExportExcel: () => void; onExportPdf: () => Promise<void> | void }> = ({ onExportExcel, onExportPdf }) => {
  const [open, setOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handlePdf = async () => {
    setOpen(false);
    setExportingPdf(true);
    try {
      await onExportPdf();
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={exportingPdf}
        className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-lg border text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-60 transition-colors"
      >
        {exportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Export
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden bg-white border rounded-lg shadow-lg border-slate-200">
          <button
            onClick={() => {
              setOpen(false);
              onExportExcel();
            }}
            className="flex items-center w-full gap-2 px-3 py-2 text-[12.5px] text-left text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" /> Export as Excel
          </button>
          <button onClick={handlePdf} className="flex items-center w-full gap-2 px-3 py-2 text-[12.5px] text-left text-slate-700 hover:bg-slate-50 border-t border-slate-100">
            <FileText size={14} className="text-red-600" /> Export as PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
