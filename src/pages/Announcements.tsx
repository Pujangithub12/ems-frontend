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
  Bell,
  Plus,
  X,
  UserCheck,
} from "lucide-react";

type User = {
  id: number;
  fullName: string;
  email: string;
};

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
  const [users, setUsers] = useState<User[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(
    null,
  );
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<
    number | null
  >(null);

  // New Announcement Form State
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"all" | "specific">("specific");
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

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

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await api.get<User[]>("/api/users");
      setUsers(response.data);
    } catch (err: any) {
      console.error("Failed to load users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    loadUsers();
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

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAnnouncementsError(null);

    const targetEmails = selectedUserIds
      .map((id) => {
        const user = users.find((u) => u.id === id);
        return user?.email;
      })
      .filter((email): email is string => Boolean(email));

    try {
      await api.post("/api/announcements", {
        subject,
        message,
        targetType,
        targetEmails: targetType === "specific" ? targetEmails : [],
      });
      setShowForm(false);
      setSubject("");
      setMessage("");
      setSelectedUserIds([]);
      loadAnnouncements();
    } catch (err: any) {
      setAnnouncementsError(
        err?.response?.data?.message || "Failed to create announcement.",
      );
    } finally {
      setSubmitting(false);
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
            <p className="text-sm text-slate-500 font-medium">
              Broadcast updates and stay informed.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              {showForm ? (
                <X className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {showForm ? "Cancel" : "Make Announcement"}
            </button>
          )}
          {!announcementsLoading && (
            <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100 uppercase tracking-widest">
              {announcements.length} Published
            </div>
          )}
        </div>
      </div>

      {/* Announcement Form (Admin Only) */}
      {showForm && user?.role === "admin" && (
        <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100/50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                New Broadcast
              </h3>
              <p className="text-sm text-slate-500">
                Create an announcement and notify recipients.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateAnnouncement} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">
                  Subject Line
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="e.g., Office Holiday Update"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">
                  Recipient Type
                </label>
                <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTargetType("specific")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
                      targetType === "specific"
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <UsersIcon className="w-4 h-4" />
                    Specific
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("all")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-xl transition-all ${
                      targetType === "all"
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Everyone
                  </button>
                </div>
              </div>
            </div>

            {targetType === "specific" && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <label className="text-sm font-bold text-slate-700 ml-1">
                  Select Recipients
                </label>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8 bg-slate-50 border border-slate-200 rounded-2xl">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-2">
                    {users.map((u) => (
                      <label
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds((prev) => [...prev, u.id]);
                            } else {
                              setSelectedUserIds((prev) =>
                                prev.filter((id) => id !== u.id),
                              );
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500/20"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {u.fullName}
                          </p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedUserIds.map((id) => {
                    const u = users.find((user) => user.id === id);
                    return (
                      u && (
                        <div
                          key={id}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-medium"
                        >
                          {u.fullName}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedUserIds((prev) =>
                                prev.filter((uid) => uid !== id),
                              )
                            }
                            className="hover:text-indigo-900 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    );
                  })}
                </div>
                {selectedUserIds.length === 0 && (
                  <p className="text-[10px] text-rose-500 ml-1">
                    Please select at least one recipient.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">
                Announcement Message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                placeholder="Write your message here..."
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Announcement
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements Content */}
      <div className="grid gap-6">
        {announcementsLoading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500 font-medium">
              Fetching news board...
            </p>
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
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              No announcements
            </h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              The news board is currently empty. Stay tuned for future updates!
            </p>
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
                        {announcement.targetEmails &&
                        announcement.targetEmails.length > 0 ? (
                          announcement.targetEmails.map((email, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium text-slate-600 hover:bg-white hover:border-indigo-100 hover:text-indigo-600 transition-all cursor-default"
                            >
                              <Mail className="w-3 h-3 opacity-60" />
                              {email}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-600">
                            All Employees
                          </div>
                        )}
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

// Added missing FileText icon
const FileText = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

export default Announcements;
