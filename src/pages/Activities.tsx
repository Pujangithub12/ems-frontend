import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { AlertCircle, Loader2, History, RefreshCw } from "lucide-react";

type ActivityItem = {
  id: number;
  type: string;
  description: string;
  taskId?: number;
  userId?: number;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
  task?: {
    id: number;
    title: string;
  };
  createdAt: string;
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

const getCategoryStyle = (type: string) => {
  switch (type) {
    case "task_created":
      return "bg-blue-50 text-blue-900";
    case "task_assigned":
      return "bg-purple-50 text-purple-900";
    case "status_changed":
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
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const pollIntervalRef = useRef<number | null>(null);

  const loadActivities = async (showLoading = true) => {
    if (showLoading) {
      setActivitiesLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setActivitiesError(null);

    try {
      const response = await api.get<any>("/api/activities");
      if (Array.isArray(response.data)) {
        setActivities(response.data);
      } else {
        setActivities([]);
      }
    } catch (err: any) {
      setActivitiesError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to load activities.",
      );
    } finally {
      if (showLoading) {
        setActivitiesLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadActivities();
    pollIntervalRef.current = setInterval(() => {
      loadActivities(false);
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const categories = [
    { id: "all", label: "All events" },
    { id: "task_created", label: "Task created" },
    { id: "task_assigned", label: "Task assigned" },
    { id: "status_changed", label: "Status changed" },
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
            onClick={() => loadActivities(false)}
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
          {activitiesLoading && activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
              <div
                className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Fetching activity log
              </div>
            </div>
          ) : activitiesError ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded flex items-center gap-3 text-red-700 text-[13px]">
              <AlertCircle className="flex-shrink-0 w-4 h-4" />
              <span>{activitiesError}</span>
            </div>
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
