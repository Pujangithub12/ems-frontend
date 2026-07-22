import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Search, Download, Printer, Send, Loader2 } from "lucide-react";
import Drawer, { DrawerSection, DrawerRow } from "../../../components/Drawer";
import { useReportCommentsQuery, useAddReportCommentMutation } from "../hooks/useReports";
import { getErrorMessage } from "../../../lib/errors";

export interface ReportDrawerColumn {
  key: string;
  label: string;
  format?: (value: any, row: Record<string, any>) => React.ReactNode;
}

export interface ReportDrawerTimelineRow {
  label: string;
  date: string;
}

const ReportDrawer: React.FC<{
  reportKey: string | null;
  title: string;
  onClose: () => void;
  summary: { label: string; value: string }[];
  records: Record<string, any>[];
  columns: ReportDrawerColumn[];
  timeline?: ReportDrawerTimelineRow[];
  exportFileName: string;
}> = ({ reportKey, title, onClose, summary, records, columns, timeline, exportFileName }) => {
  const [search, setSearch] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const commentsQuery = useReportCommentsQuery(reportKey);
  const addCommentMutation = useAddReportCommentMutation();

  const filteredRecords = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.trim().toLowerCase();
    return records.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [records, search]);

  const handleExport = () => {
    const sheetRows = filteredRecords.map((row) => {
      const out: Record<string, any> = {};
      columns.forEach((c) => (out[c.label] = row[c.key]));
      return out;
    });
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");
    XLSX.writeFile(workbook, `${exportFileName}.xlsx`);
  };

  const handleAddComment = async () => {
    if (!reportKey || !commentBody.trim()) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      await addCommentMutation.mutateAsync({ reportKey, body: commentBody.trim() });
      setCommentBody("");
      await commentsQuery.refetch();
    } catch (err) {
      setCommentError(getErrorMessage(err, "Failed to add comment."));
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <Drawer open={!!reportKey} onClose={onClose} title={title} width={520}>
      <DrawerSection
        title="Summary"
        action={
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline">
              <Download size={12} /> Export
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 text-[11px] font-medium text-blue-900 hover:underline">
              <Printer size={12} /> Print
            </button>
          </div>
        }
      >
        {summary.map((s) => (
          <DrawerRow key={s.label} label={s.label}>
            {s.value}
          </DrawerRow>
        ))}
      </DrawerSection>

      <DrawerSection title="Filters">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search underlying records..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded outline-none focus:border-blue-400"
          />
        </div>
      </DrawerSection>

      <DrawerSection title={`Underlying Records (${filteredRecords.length})`}>
        {filteredRecords.length === 0 ? (
          <p className="text-[12px] text-slate-400">No records match.</p>
        ) : (
          <div className="overflow-x-auto border rounded border-slate-100">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase">
                  {columns.map((c) => (
                    <th key={c.key} className="px-2 py-1.5 font-medium text-left">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 100).map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-2 py-1.5 text-slate-700">
                        {c.format ? c.format(row[c.key], row) : String(row[c.key] ?? "--")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DrawerSection>

      {timeline && (
        <DrawerSection title="Timeline">
          {timeline.length === 0 ? (
            <p className="text-[12px] text-slate-400">No history recorded.</p>
          ) : (
            timeline.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0 text-[12px]">
                <span className="text-slate-700">{t.label}</span>
                <span className="text-slate-400">
                  {new Date(t.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
            ))
          )}
        </DrawerSection>
      )}

      <DrawerSection title="Comments">
        {commentsQuery.isLoading ? (
          <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
        ) : (commentsQuery.data ?? []).length === 0 ? (
          <p className="mb-3 text-[12px] text-slate-400">No comments yet.</p>
        ) : (
          <div className="mb-3 space-y-2">
            {(commentsQuery.data ?? []).map((c) => (
              <div key={c.id} className="text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{c.createdBy?.fullName || "Someone"}</span>
                  <span className="text-slate-400">
                    {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-slate-600">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        {commentError && <p className="mb-2 text-[11px] text-red-600">{commentError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={2}
            placeholder="Add a note..."
            className="flex-1 px-2 py-1.5 text-[12px] border border-slate-200 rounded outline-none resize-none focus:border-blue-400"
          />
          <button
            disabled={submittingComment || !commentBody.trim()}
            onClick={handleAddComment}
            className="flex items-center justify-center w-8 h-8 text-white rounded bg-blue-900 hover:bg-blue-800 disabled:opacity-60"
          >
            {submittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </DrawerSection>
    </Drawer>
  );
};

export default ReportDrawer;
