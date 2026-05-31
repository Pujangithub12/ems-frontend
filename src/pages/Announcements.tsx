import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import { 
  Megaphone, 
  Trash2, 
  Clock, 
  Users as UsersIcon, 
  Mail, 
  AlertCircle, 
  Loader2,
  Calendar,
  ChevronRight,
  Send,
  Bell
} from "lucide-react";

type Announcement = {
  id: number;
  subject: string;
  message: string;
  targetType: string;
  targetEmails: string[];
  createdAt: string;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const Announcements: React.FC = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(
    null,
  );
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<
    number | null
  >(null);

  useEffect(() => {
    const loadAnnouncements = async () => {
      setAnnouncementsLoading(true);
      setAnnouncementsError(null);

      try {
        const response = await api.get<any>("/api/announcements");
        if (Array.isArray(response.data)) {
          setAnnouncements(response.data);
        } else if (Array.isArray(response.data.announcements)) {
          setAnnouncements(response.data.announcements);
        } else if (response.data?.announcement) {
          setAnnouncements([response.data.announcement]);
        } else if (Array.isArray(response.data?.history)) {
          setAnnouncements(response.data.history);
        } else {
          setAnnouncements([]);
        }
      } catch (err: any) {
        setAnnouncementsError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load announcements.",
        );
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    loadAnnouncements();
  }, []);

  const deleteAnnouncement = async (id: number) => {
    if (!window.confirm("Are you sure you want to remove this announcement?")) {
      return;
    }

    setDeletingAnnouncementId(id);
    setAnnouncementsError(null);

    try {
      await api.delete(`/api/announcements/${id}`);
      setAnnouncements((prev) =>
        prev.filter((announcement) => announcement.id !== id),
      );
    } catch (err: any) {
      setAnnouncementsError(
        err?.response?.data?.message ||
          err.message ||
          "Unable to delete announcement.",
      );
    } finally {
      setDeletingAnnouncementId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm text-indigo-600">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Announcements</h2>
            <p className="text-sm text-slate-500 font-medium">Broadcast updates and stay informed.</p>
          </div>
        </div>
        {!announcementsLoading && (
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 uppercase tracking-widest">
            {announcements.length} Published
          </div>
        )}
      </div>

      {/* Announcements Content */}
      <div className="grid gap-6">
        {announcementsLoading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500 font-medium">Fetching news board...</p>
          </div>
        ) : announcementsError ? (
          <div className="p-6 bg-rose-50 border border-rose-100 rounded-3xl text-rose-700 flex items-center gap-4">
            <AlertCircle className="w-6 h-6" />
            <p className="font-medium">{announcementsError}</p>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed text-center px-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Megaphone className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No announcements</h3>
            <p className="text-slate-500 max-w-sm mx-auto">The news board is currently empty. Stay tuned for future updates!</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 group"
            >
              <div className="p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Left Icon Decor */}
                  <div className="hidden lg:flex flex-col items-center gap-4 pt-1">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all duration-300">
                      <Send className="w-5 h-5" />
                    </div>
                    <div className="w-px flex-1 bg-slate-100 group-hover:bg-indigo-100 transition-colors" />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-full border border-slate-200">
                        {announcement.targetType}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        Posted {formatDate(announcement.createdAt)}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {announcement.subject}
                      </h3>
                      <p className="mt-4 text-slate-600 leading-relaxed text-base whitespace-pre-wrap">
                        {announcement.message}
                      </p>
                    </div>

                    <div className="pt-4 flex flex-col gap-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                        <UsersIcon className="w-4 h-4 text-indigo-500" />
                        Target Recipients
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {announcement.targetEmails.map((email, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:bg-white hover:border-indigo-100 hover:text-indigo-600 transition-all cursor-default"
                          >
                            <Mail className="w-3 h-3 opacity-60" />
                            {email}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar/Action for Admin */}
                  {user?.role === "admin" && (
                    <div className="flex lg:flex-col items-center justify-between lg:justify-start lg:pl-8 lg:border-l lg:border-slate-100 min-w-[120px]">
                      <button
                        onClick={() => deleteAnnouncement(announcement.id)}
                        disabled={deletingAnnouncementId === announcement.id}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold hover:bg-rose-50 transition-all disabled:opacity-50 group/del"
                      >
                        {deletingAnnouncementId === announcement.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 transition-transform group-hover/del:scale-110" />
                            Remove
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default Announcements;
