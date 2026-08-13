import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../features/notifications/hooks/useNotifications";
import { useNotificationMute } from "../features/notifications/hooks/useNotificationMute";
import type { Notification } from "../features/notifications/api/notifications.api";

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

const NotificationBell: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { isMuted, mutedUntilLabel, unmute } = useNotificationMute();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
      >
        {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {unreadCount > 0 && !isMuted && (
          <span className="absolute w-[7px] h-[7px] rounded-full bg-red-600 top-[7px] right-[7px] border-[1.5px] border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] bg-white rounded-xl border border-slate-200/70 w-80 z-50 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/60">
            <span className="font-semibold text-[13px] text-slate-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-[11px] text-blue-900 hover:underline"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>
          {isMuted && (
            <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200 text-[11.5px] text-amber-800">
              <span className="flex items-center gap-1.5">
                <BellOff className="w-3 h-3" />
                Muted {mutedUntilLabel}
              </span>
              <button onClick={unmute} className="font-medium hover:underline">
                Unmute
              </button>
            </div>
          )}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-3.5 py-10 text-center">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 ring-1 ring-slate-200">
                  <Bell className="w-4 h-4 text-slate-400" />
                </div>
                <div className="text-[12.5px] text-slate-400">No notifications yet</div>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-100 hover:bg-slate-50 flex gap-2 transition-colors ${
                    n.isRead ? "" : "bg-blue-50/60"
                  }`}
                >
                  {!n.isRead && (
                    <span className="mt-1.5 w-[6px] h-[6px] rounded-full bg-blue-900 flex-shrink-0" />
                  )}
                  <div className={`min-w-0 ${n.isRead ? "pl-[14px]" : ""}`}>
                    <div className="font-medium text-[12.5px] text-slate-900 truncate">
                      {n.title}
                    </div>
                    <div className="text-[12px] text-slate-500 line-clamp-2">{n.message}</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
