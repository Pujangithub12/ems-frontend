import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/** Client-side pagination over an already-filtered array. No prior in-app convention — built for this table redesign. */
const Pagination: React.FC<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}> = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-t border-slate-200">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
            onPageChange(1);
          }}
          className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-slate-500">
        <span>
          {total === 0 ? "0 results" : `Showing ${start}–${end} of ${total}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="flex items-center justify-center w-7 h-7 border rounded border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-1 text-slate-600">
            {page} / {pageCount}
          </span>
          <button
            onClick={() => onPageChange(Math.min(pageCount, page + 1))}
            disabled={page >= pageCount}
            className="flex items-center justify-center w-7 h-7 border rounded border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
