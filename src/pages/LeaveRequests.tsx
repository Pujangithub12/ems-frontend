import React, { useEffect, useState, useMemo } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Loader2,
  X,
} from "lucide-react";

type LeaveRequest = {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  historyCount?: number;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
};

const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`text-[10px] tracking-[0.1em] uppercase text-slate-400 ${className}`}
    style={{ fontFamily: "'JetBrains Mono', monospace" }}
  >
    {children}
  </div>
);

const getInitials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const LeaveRequests: React.FC = () => {
  const { user, workspace } = useAuth();
  const isAdmin = user?.role === "admin";

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");

  // Form state
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get<LeaveRequest[]>("/api/leaverequest");
      setRequests(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [workspace?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/api/leaverequest", { title, startDate, endDate, reason });
      setShowForm(false);
      resetForm();
      await loadRequests();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: number, status: "approved" | "rejected") => {
    try {
      await api.put(`/api/leaverequest/${id}/status`, { status });
      await loadRequests();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Failed to update status");
    }
  };

  const resetForm = () => {
    setTitle("");
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  const tabs = useMemo(() => {
    return [
      { id: "all", label: "All", count: requests.length },
      { id: "pending", label: "Pending", count: requests.filter((r) => r.status === "pending").length, urgent: true },
      { id: "approved", label: "Approved", count: requests.filter((r) => r.status === "approved").length },
      { id: "rejected", label: "Rejected", count: requests.filter((r) => r.status === "rejected").length },
    ];
  }, [requests]);

  const filtered = useMemo(() => {
    if (tab === "all") return requests;
    return requests.filter((r) => r.status === tab);
  }, [requests, tab]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "approved":
        return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-700" };
      case "rejected":
        return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-700" };
      default:
        return { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-700" };
    }
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md border-slate-200">
      {/* Tab Bar */}
      <div className="flex items-end flex-shrink-0 gap-1 px-6 pt-3 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id
                ? "border-slate-900 text-slate-900 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            style={{ padding: "10px 14px", fontSize: 13, marginBottom: -1 }}
          >
            {t.label}
            <span
              className={`rounded-full ${
                t.urgent ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
              }`}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {t.count}
            </span>
          </button>
        ))}

        {!isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="ml-auto bg-slate-900 text-white rounded flex items-center gap-1.5 mb-2 hover:bg-slate-800 transition-colors"
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && !isAdmin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>New Leave Request</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">Submit Application</h3>
              </div>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded flex items-center gap-2 text-[13px]">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <Eyebrow className="mb-1.5">Title</Eyebrow>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="e.g., Annual Vacation"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Eyebrow className="mb-1.5">Start Date</Eyebrow>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                </div>
                <div>
                  <Eyebrow className="mb-1.5">End Date</Eyebrow>
                  <input
                    required
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  />
                </div>
              </div>
              <div>
                <Eyebrow className="mb-1.5">Reason</Eyebrow>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                  placeholder="Briefly explain the reason for your leave..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
            <div
              className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Loading requests
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No requests found</h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {isAdmin
                ? "There are currently no leave applications to review."
                : "You haven't submitted any leave requests yet."}
            </p>
          </div>
        ) : (
          filtered.map((request) => {
            const statusStyle = getStatusStyle(request.status);
            const userName = request.user?.fullName || "You";
            const initials = getInitials(userName);
            
            const ageDays = Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const ageLabel = ageDays === 0 ? "today" : `${ageDays}d old`;

            return (
              <div
                key={request.id}
                className="grid items-center px-6 py-4 transition-colors border-b border-slate-200 hover:bg-slate-50"
                style={{ gridTemplateColumns: "32px 1fr auto auto auto", gap: 16 }}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                  {initials}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <div className="text-[13px] text-slate-900">
                    <span className="font-semibold">{userName}</span>
                    <span className="text-slate-500"> · {request.title}</span>
                    {isAdmin && request.historyCount !== undefined && request.historyCount > 0 && (
                      <span
                        className="ml-2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                        style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {request.historyCount} past leaves
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 flex items-center gap-2 mt-0.5" style={{ fontSize: 12 }}>
                    <span className="truncate">{request.reason}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Status Tag */}
                <span
                  className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                  {request.status}
                </span>

                {/* Age */}
                <span
                  className={`text-[12px] whitespace-nowrap ${
                    ageDays >= 3 ? "text-red-700" : "text-slate-500"
                  }`}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {ageLabel}
                </span>

                {/* Actions */}
                <div className="flex gap-1">
                  {isAdmin && request.status === "pending" ? (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(request.id, "approved")}
                        className="flex items-center justify-center transition-colors bg-white border rounded border-slate-200 text-emerald-700 hover:bg-emerald-50"
                        style={{ width: 28, height: 28 }}
                        title="Approve"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(request.id, "rejected")}
                        className="flex items-center justify-center text-red-700 transition-colors bg-white border rounded border-slate-200 hover:bg-red-50"
                        style={{ width: 28, height: 28 }}
                        title="Reject"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="w-[60px]"></div> // Spacer to maintain grid alignment
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LeaveRequests;