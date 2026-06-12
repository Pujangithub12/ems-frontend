import React, { useEffect, useState, useRef } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Activity,
  Clock,
  User,
  CheckSquare,
  AlertCircle,
  Loader2,
  History,
  Zap,
  Users,
  RefreshCw,
} from "lucide-react";

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

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getActivityIcon = (type: string) => {
  switch (type) {
    case "task_created":
      return <CheckSquare className="w-5 h-5" />;
    case "task_assigned":
      return <Users className="w-5 h-5" />;
    case "status_changed":
      return <Zap className="w-5 h-5" />;
    default:
      return <Activity className="w-5 h-5" />;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case "task_created":
      return "bg-emerald-50 text-emerald-600 border-emerald-100";
    case "task_assigned":
      return "bg-blue-50 text-blue-600 border-blue-100";
    case "status_changed":
      return "bg-amber-50 text-amber-600 border-amber-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
};

const Activities: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
    // Load activities initially
    loadActivities();

    // Start polling for new activities every 5 seconds
    pollIntervalRef.current = setInterval(() => {
      loadActivities(false);
    }, 5000);

    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-indigo-600">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Activity History
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              Track all task and system events.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadActivities(false)}
            disabled={isRefreshing || activitiesLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          {!activitiesLoading && (
            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 uppercase tracking-widest">
              {activities.length} Events
            </div>
          )}
        </div>
      </div>

      {/* Activities Content */}
      <div className="grid gap-6">
        {activitiesLoading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500 font-medium">
              Fetching activity log...
            </p>
          </div>
        ) : activitiesError ? (
          <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-rose-700 flex items-center gap-4">
            <AlertCircle className="w-6 h-6" />
            <p className="font-medium">{activitiesError}</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed text-center px-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <History className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              No activity yet
            </h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              The activity log is empty. As tasks are created and updated,
              events will appear here!
            </p>
          </div>
        ) : (
          <div className="relative pl-8">
            {/* Vertical Timeline Line */}
            <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-slate-200" />

            {activities.map((activity) => (
              <div key={activity.id} className="relative mb-8">
                {/* Timeline Dot */}
                <div
                  className={`absolute left-[-25px] mt-2.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${getActivityColor(activity.type).split(" ")[0]}`}
                >
                  {getActivityIcon(activity.type)}
                </div>

                <article className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 group">
                  <div className="p-6 lg:p-8">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <span
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-full border ${getActivityColor(activity.type)}`}
                      >
                        {activity.type.replace("_", " ")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(activity.createdAt)}
                      </span>
                      {activity.user && (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                          <User className="w-3.5 h-3.5" />
                          {activity.user.fullName}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium text-slate-900">
                      {activity.description}
                    </p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Activities;
