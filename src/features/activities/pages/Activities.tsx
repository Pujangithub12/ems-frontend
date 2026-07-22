import React, { useMemo, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { useActivities } from "../hooks/useActivities";
import { getErrorMessage } from "../../../lib/errors";
import LoadingState from "../../../components/LoadingState";
import ErrorBanner from "../../../components/ErrorBanner";
import type { ActivityItem } from "../api/activities.api";

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

const getCategoryStyle = (type: string) => {
  switch (type) {
    case "task_created":
      return "bg-blue-50 text-blue-900";
    case "task_assigned":
      return "bg-purple-50 text-purple-900";
    case "member_invited":
      return "bg-emerald-50 text-emerald-900";
    case "project_created":
      return "bg-amber-50 text-amber-900";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const formatDateGroup = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dateOnly.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const Activities: React.FC = () => {
  const [filter, setFilter] = useState("all");

  const {
    data: activities = [],
    isLoading: activitiesLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useActivities({ poll: true });
  const isRefreshing = isFetching && !activitiesLoading;

  const categories = [
    { id: "all", label: "All events" },
    { id: "task_created", label: "Task created" },
    { id: "task_assigned", label: "Task assigned" },
    { id: "member_invited", label: "Member invited" },
    { id: "project_created", label: "Project created" },
  ];

  const filtered = useMemo(() => {
    let list = activities;
    if (filter !== "all") {
      list = list.filter((a) => a.type === filter);
    }
    return list;
  }, [activities, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    filtered.forEach((a) => {
      const dateKey = new Date(a.createdAt).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(a);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F6F7F9]">
      {/* Top Filter Bar */}
      <div className="flex items-center flex-shrink-0 gap-2 px-6 py-3 overflow-x-auto bg-white border-b border-slate-200">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full border whitespace-nowrap px-3 py-1 text-[12px] font-medium transition-colors ${
              filter === c.id
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.label}
          </button>
        ))}

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => refetch()}
            disabled={isRefreshing || activitiesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl px-8 py-8 mx-auto">
          {activitiesLoading ? (
            <LoadingState label="Fetching activity log" className="py-20" />
          ) : isError ? (
            <ErrorBanner message={getErrorMessage(error, "Unable to load activities.")} />
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                <History className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                No activity yet
              </h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                The activity log is empty. As tasks are created and updated,
                events will appear here.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([dateKey, items]) => (
              <div key={dateKey} className="mb-8">
                <Eyebrow>{formatDateGroup(items[0].createdAt)}</Eyebrow>
                <div className="mt-3 overflow-hidden bg-white border rounded-md border-slate-200">
                  {items.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-4 px-5 py-3.5 border-b border-slate-200 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      {/* Time */}
                      <div
                        className="text-slate-400"
                        style={{
                          fontSize: 11,
                          width: 48,
                          paddingTop: 2,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {formatTime(a.createdAt)}
                      </div>

                      {/* Description */}
                      <div className="flex-1 min-w-0">
                        <div className="text-slate-600 leading-snug text-[13px]">
                          <span className="font-medium text-slate-900">
                            {a.user?.fullName || "System"}
                          </span>{" "}
                          {a.description}
                        </div>
                      </div>

                      {/* Category Pill */}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium flex-shrink-0 ${getCategoryStyle(a.type)}`}
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {a.type.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Activities;
