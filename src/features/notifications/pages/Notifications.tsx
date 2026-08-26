import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../hooks/useNotifications";
import type { Notification } from "../api/notifications.api";

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

/** Full notification history — the bell popup only shows the 4 most recent with a
 * "View more" link into this page. */
const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 bg-white">
        <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        <p className="text-[12px] text-slate-400">Loading notifications…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full p-6 bg-white lg:px-8 lg:py-8">
      <div className="flex flex-col w-full min-w-0 gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">All Notifications</h2>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 overflow-hidden bg-white border rounded-xl shadow-md border-slate-200">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                <Bell className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">No notifications yet</h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                You'll see updates about tasks, approvals, and announcements here.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-5 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 flex gap-2.5 transition-colors ${
                  n.isRead ? "" : "bg-blue-50/60"
                }`}
              >
                {!n.isRead && (
                  <span className="mt-1.5 w-[6px] h-[6px] rounded-full bg-blue-900 flex-shrink-0" />
                )}
                <div className={`min-w-0 ${n.isRead ? "pl-[14px]" : ""}`}>
                  <div className="font-medium text-[13px] text-slate-900">{n.title}</div>
                  <div className="text-[12.5px] text-slate-500">{n.message}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
