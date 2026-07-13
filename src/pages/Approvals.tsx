import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthProvider";
import {
  CalendarDays,
  MapPin,
  Receipt,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  X,
  LayoutGrid,
} from "lucide-react";
import LoadingState from "../components/LoadingState";
import ErrorBanner from "../components/ErrorBanner";
import { getErrorMessage } from "../lib/errors";
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useUpdateLeaveRequestStatus,
} from "../hooks/useLeaveRequests";
import {
  useSiteVisitRequests,
  useCreateSiteVisitRequest,
  useUpdateSiteVisitRequestStatus,
} from "../hooks/useSiteVisitRequests";
import {
  useExpenseRequests,
  useCreateExpenseRequest,
  useUpdateExpenseRequestStatus,
} from "../hooks/useExpenseRequests";
import { useHierarchy } from "../hooks/useHierarchy";
import { canApprove as hierarchyCanApprove } from "../lib/hierarchyAuthority";

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

type RequestType = "leave" | "sitevisit" | "expense";
type TabId = RequestType | "all" | "rejected";

type NormalizedRequest = {
  id: number;
  type: RequestType;
  title: string;
  reason: string;
  meta?: string;
  dateLabel: string;
  status: "pending" | "approved" | "rejected";
  user?: { id: number; fullName: string };
  createdAt: string;
};

const TYPE_META: Record<RequestType, { label: string; icon: React.ElementType; fg: string; bg: string }> = {
  leave: { label: "Leave Request", icon: CalendarDays, fg: "#1E3A8A", bg: "#DBEAFE" },
  sitevisit: { label: "Site Visit", icon: MapPin, fg: "#6D28D9", bg: "#EDE9FE" },
  expense: { label: "Expense", icon: Receipt, fg: "#047857", bg: "#D1FAE5" },
};

const EXPENSE_CATEGORIES = ["Travel", "Supplies", "Meals", "Other"];

const Approvals: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;
  const currentUserId = user?.id;

  const { data: hierarchyPeople = [] } = useHierarchy();

  const leaveQuery = useLeaveRequests();
  const siteVisitQuery = useSiteVisitRequests();
  const expenseQuery = useExpenseRequests();

  const createLeave = useCreateLeaveRequest();
  const createSiteVisit = useCreateSiteVisitRequest();
  const createExpense = useCreateExpenseRequest();

  const updateLeaveStatus = useUpdateLeaveRequestStatus();
  const updateSiteVisitStatus = useUpdateSiteVisitRequestStatus();
  const updateExpenseStatus = useUpdateExpenseRequestStatus();

  // Who can approve/reject each request type — matches this app's default
  // permission grants (leave.manage / sitevisit.manage / expense.manage):
  // admin + super_admin for all three, plus finance specifically for expenses.
  const canManage: Record<RequestType, boolean> = {
    leave: role === "admin" || role === "super_admin",
    sitevisit: role === "admin" || role === "super_admin",
    expense: role === "admin" || role === "super_admin" || role === "finance",
  };

  // Approve/Reject on a *specific* request additionally requires being that
  // requester's nearest admin ancestor in the org chart — "the admin of that
  // user" — mirroring the backend's hierarchy check. Finance keeps its
  // unconditional cross-cutting approval on Expense (not hierarchy-gated),
  // and super_admin (the account's root) can always approve, matching the
  // backend's fallback so requests never get stuck while the tree is
  // incomplete.
  const canApproveRequest = (type: RequestType, requesterUserId: number | undefined) => {
    if (!canManage[type] || !currentUserId || requesterUserId == null) return false;
    if (type === "expense" && role === "finance") return true;
    if (role === "super_admin") return true;
    return hierarchyCanApprove(hierarchyPeople, Number(currentUserId), role || "", requesterUserId);
  };

  const [tab, setTab] = useState<TabId>("all");
  const [showForm, setShowForm] = useState(false);
  const [reqType, setReqType] = useState<RequestType>("leave");
  const [formError, setFormError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Leave form state
  const [leaveTitle, setLeaveTitle] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");

  // Site visit form state
  const [svTitle, setSvTitle] = useState("");
  const [svLocation, setSvLocation] = useState("");
  const [svDate, setSvDate] = useState("");
  const [svReason, setSvReason] = useState("");

  // Expense form state
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expDate, setExpDate] = useState("");
  const [expReason, setExpReason] = useState("");

  const resetForms = () => {
    setLeaveTitle(""); setLeaveStart(""); setLeaveEnd(""); setLeaveReason("");
    setSvTitle(""); setSvLocation(""); setSvDate(""); setSvReason("");
    setExpTitle(""); setExpAmount(""); setExpCategory(EXPENSE_CATEGORIES[0]); setExpDate(""); setExpReason("");
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
    resetForms();
  };

  const submitting = createLeave.isPending || createSiteVisit.isPending || createExpense.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      if (reqType === "leave") {
        await createLeave.mutateAsync({
          title: leaveTitle, startDate: leaveStart, endDate: leaveEnd, reason: leaveReason,
        });
      } else if (reqType === "sitevisit") {
        await createSiteVisit.mutateAsync({
          title: svTitle, location: svLocation, visitDate: svDate, reason: svReason,
        });
      } else if (reqType === "expense") {
        await createExpense.mutateAsync({
          title: expTitle, amount: Number(expAmount), category: expCategory,
          expenseDate: expDate, reason: expReason,
        });
      }
      closeForm();
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to submit request"));
    }
  };

  const handleStatusUpdate = async (type: RequestType, id: number, status: "approved" | "rejected") => {
    setStatusError(null);
    try {
      if (type === "leave") await updateLeaveStatus.mutateAsync({ id, status });
      else if (type === "sitevisit") await updateSiteVisitStatus.mutateAsync({ id, status });
      else await updateExpenseStatus.mutateAsync({ id, status });
    } catch (err) {
      setStatusError(getErrorMessage(err, "Failed to update status"));
    }
  };

  const loading = leaveQuery.isLoading || siteVisitQuery.isLoading || expenseQuery.isLoading;
  const queryError = leaveQuery.isError
    ? getErrorMessage(leaveQuery.error, "Failed to load leave requests")
    : siteVisitQuery.isError
      ? getErrorMessage(siteVisitQuery.error, "Failed to load site visit requests")
      : expenseQuery.isError
        ? getErrorMessage(expenseQuery.error, "Failed to load expense requests")
        : null;

  const normalized = useMemo<Record<RequestType, NormalizedRequest[]>>(() => {
    const leave: NormalizedRequest[] = (leaveQuery.data || []).map((r) => ({
      id: r.id,
      type: "leave",
      title: r.title,
      reason: r.reason,
      dateLabel: `${new Date(r.startDate).toLocaleDateString()} - ${new Date(r.endDate).toLocaleDateString()}`,
      status: r.status,
      user: r.user,
      createdAt: r.createdAt,
    }));
    const sitevisit: NormalizedRequest[] = (siteVisitQuery.data || []).map((r) => ({
      id: r.id,
      type: "sitevisit",
      title: r.title,
      reason: r.reason,
      meta: r.location,
      dateLabel: new Date(r.visitDate).toLocaleDateString(),
      status: r.status,
      user: r.user,
      createdAt: r.createdAt,
    }));
    const expense: NormalizedRequest[] = (expenseQuery.data || []).map((r) => ({
      id: r.id,
      type: "expense",
      title: r.title,
      reason: r.reason,
      meta: `$${Number(r.amount).toFixed(2)} · ${r.category}`,
      dateLabel: new Date(r.expenseDate).toLocaleDateString(),
      status: r.status,
      user: r.user,
      createdAt: r.createdAt,
    }));
    return { leave, sitevisit, expense };
  }, [leaveQuery.data, siteVisitQuery.data, expenseQuery.data]);

  const tabs = useMemo(() => {
    const activeCount = (type: RequestType) => normalized[type].filter((r) => r.status !== "rejected").length;
    const pendingCount = (type: RequestType) => normalized[type].filter((r) => r.status === "pending").length;
    const allActiveTotal = activeCount("leave") + activeCount("sitevisit") + activeCount("expense");
    const allPendingTotal = pendingCount("leave") + pendingCount("sitevisit") + pendingCount("expense");
    const rejectedTotal =
      normalized.leave.filter((r) => r.status === "rejected").length +
      normalized.sitevisit.filter((r) => r.status === "rejected").length +
      normalized.expense.filter((r) => r.status === "rejected").length;

    return [
      { id: "all" as const, label: "All", icon: LayoutGrid, count: allActiveTotal, urgent: allPendingTotal > 0 },
      { id: "leave" as const, label: TYPE_META.leave.label, icon: TYPE_META.leave.icon, count: activeCount("leave"), urgent: pendingCount("leave") > 0 },
      { id: "sitevisit" as const, label: TYPE_META.sitevisit.label, icon: TYPE_META.sitevisit.icon, count: activeCount("sitevisit"), urgent: pendingCount("sitevisit") > 0 },
      { id: "expense" as const, label: TYPE_META.expense.label, icon: TYPE_META.expense.icon, count: activeCount("expense"), urgent: pendingCount("expense") > 0 },
      { id: "rejected" as const, label: "Rejected", icon: XCircle, count: rejectedTotal, urgent: false },
    ];
  }, [normalized]);

  const filtered = useMemo<NormalizedRequest[]>(() => {
    if (tab === "rejected") {
      return [...normalized.leave, ...normalized.sitevisit, ...normalized.expense]
        .filter((r) => r.status === "rejected")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (tab === "all") {
      return [...normalized.leave, ...normalized.sitevisit, ...normalized.expense]
        .filter((r) => r.status !== "rejected")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return normalized[tab].filter((r) => r.status !== "rejected");
  }, [tab, normalized]);

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

  // Types the current user is not a manager/approver for — i.e. types they can
  // submit their own requests for via the "New Request" button.
  const creatableTypes = (["leave", "sitevisit", "expense"] as RequestType[]).filter((t) => !canManage[t]);
  const currentTypeCanManage = tab !== "rejected" && tab !== "all" && canManage[tab];
  const currentTypeLabel = tab === "rejected" || tab === "all" ? "" : TYPE_META[tab].label;
  const showNewRequestButton =
    tab === "all" ? creatableTypes.length > 0 : tab !== "rejected" && !currentTypeCanManage;

  const openForm = () => {
    setReqType(tab === "all" || tab === "rejected" ? creatableTypes[0] : tab);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md border-slate-200">
      {/* Tab Bar */}
      <div className="flex items-end flex-shrink-0 gap-1 px-6 pt-3 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
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
              <Icon className="w-3.5 h-3.5" />
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
          );
        })}

        {showNewRequestButton && (
          <button
            onClick={openForm}
            className="ml-auto bg-slate-900 text-white rounded flex items-center gap-1.5 mb-2 hover:bg-slate-800 transition-colors"
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
          <div className="w-full max-w-lg overflow-hidden bg-white border rounded-md shadow-lg border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>New {TYPE_META[reqType].label}</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">Submit Application</h3>
              </div>
              <button
                onClick={closeForm}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded flex items-center gap-2 text-[13px]">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  <span>{formError}</span>
                </div>
              )}

              {creatableTypes.length > 1 && (
                <div>
                  <Eyebrow className="mb-1.5">Request Type</Eyebrow>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as RequestType)}
                    className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  >
                    {creatableTypes.map((t) => (
                      <option key={t} value={t}>{TYPE_META[t].label}</option>
                    ))}
                  </select>
                </div>
              )}

              {reqType === "leave" && (
                <>
                  <div>
                    <Eyebrow className="mb-1.5">Title</Eyebrow>
                    <input
                      required
                      value={leaveTitle}
                      onChange={(e) => setLeaveTitle(e.target.value)}
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
                        value={leaveStart}
                        onChange={(e) => setLeaveStart(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      />
                    </div>
                    <div>
                      <Eyebrow className="mb-1.5">End Date</Eyebrow>
                      <input
                        required
                        type="date"
                        value={leaveEnd}
                        onChange={(e) => setLeaveEnd(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Reason</Eyebrow>
                    <textarea
                      required
                      rows={3}
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                      placeholder="Briefly explain the reason for your leave..."
                    />
                  </div>
                </>
              )}

              {reqType === "sitevisit" && (
                <>
                  <div>
                    <Eyebrow className="mb-1.5">Title</Eyebrow>
                    <input
                      required
                      value={svTitle}
                      onChange={(e) => setSvTitle(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      placeholder="e.g., Client Site Inspection"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Eyebrow className="mb-1.5">Location</Eyebrow>
                      <input
                        required
                        value={svLocation}
                        onChange={(e) => setSvLocation(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                        placeholder="e.g., Pokhara Site"
                      />
                    </div>
                    <div>
                      <Eyebrow className="mb-1.5">Visit Date</Eyebrow>
                      <input
                        required
                        type="date"
                        value={svDate}
                        onChange={(e) => setSvDate(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Purpose</Eyebrow>
                    <textarea
                      required
                      rows={3}
                      value={svReason}
                      onChange={(e) => setSvReason(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                      placeholder="Briefly explain the purpose of this visit..."
                    />
                  </div>
                </>
              )}

              {reqType === "expense" && (
                <>
                  <div>
                    <Eyebrow className="mb-1.5">Title</Eyebrow>
                    <input
                      required
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      placeholder="e.g., Client Dinner"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Eyebrow className="mb-1.5">Amount</Eyebrow>
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={expAmount}
                        onChange={(e) => setExpAmount(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Eyebrow className="mb-1.5">Category</Eyebrow>
                      <select
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      >
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Eyebrow className="mb-1.5">Date</Eyebrow>
                      <input
                        required
                        type="date"
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <Eyebrow className="mb-1.5">Reason</Eyebrow>
                    <textarea
                      required
                      rows={3}
                      value={expReason}
                      onChange={(e) => setExpReason(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                      placeholder="Briefly justify this expense..."
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeForm}
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
        {statusError && (
          <div className="p-4">
            <ErrorBanner message={statusError} onDismiss={() => setStatusError(null)} />
          </div>
        )}
        {loading ? (
          <LoadingState label="Loading requests" className="py-20" />
        ) : queryError ? (
          <div className="p-4">
            <ErrorBanner message={queryError} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
              <CalendarDays className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No requests found</h3>
            <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
              {tab === "rejected"
                ? "No rejected requests yet."
                : tab === "all"
                  ? "There are currently no pending or approved requests."
                  : currentTypeCanManage
                    ? `There are currently no ${currentTypeLabel.toLowerCase()} applications to review.`
                    : `You haven't submitted any ${currentTypeLabel.toLowerCase()} requests yet.`}
            </p>
          </div>
        ) : (
          filtered.map((request) => {
            const statusStyle = getStatusStyle(request.status);
            const userName = request.user?.fullName || "You";
            const initials = getInitials(userName);
            const typeMeta = TYPE_META[request.type];

            const ageDays = Math.floor((Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const ageLabel = ageDays === 0 ? "today" : `${ageDays}d old`;
            const canActOnThisRequest = canApproveRequest(request.type, request.user?.id);

            return (
              <div
                key={`${request.type}-${request.id}`}
                className="grid items-center px-6 py-4 transition-colors border-b border-slate-200 hover:bg-slate-50"
                style={{ gridTemplateColumns: "32px 1fr auto auto auto", gap: 16 }}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                  {initials}
                </div>

                {/* Details */}
                <div className="min-w-0">
                  <div className="text-[13px] text-slate-900 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{userName}</span>
                    <span className="text-slate-500">· {request.title}</span>
                    {(tab === "rejected" || tab === "all") && (
                      <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{ background: typeMeta.bg, color: typeMeta.fg }}
                      >
                        <typeMeta.icon className="w-3 h-3" />
                        {typeMeta.label}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap" style={{ fontSize: 12 }}>
                    <span className="truncate">{request.reason}</span>
                    {request.meta && (
                      <>
                        <span>·</span>
                        <span className="whitespace-nowrap">{request.meta}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="whitespace-nowrap">{request.dateLabel}</span>
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
                  {tab !== "rejected" && canActOnThisRequest && request.status === "pending" ? (
                    <>
                      <button
                        onClick={() => handleStatusUpdate(request.type, request.id, "approved")}
                        className="flex items-center justify-center transition-colors bg-white border rounded border-slate-200 text-emerald-700 hover:bg-emerald-50"
                        style={{ width: 28, height: 28 }}
                        title="Approve"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(request.type, request.id, "rejected")}
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

export default Approvals;
