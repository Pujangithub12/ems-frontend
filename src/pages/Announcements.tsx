import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthProvider";
import {
  Megaphone,
  Trash2,
  AlertCircle,
  Loader2,
  Send,
  Plus,
  X,
  UserCheck,
  Users as UsersIcon,
} from "lucide-react";
import ConfirmationModal from "../components/ConfirmationModal";

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
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const Avatar: React.FC<{ name: string; size?: number }> = ({
  name,
  size = 36,
}) => (
  <div
    className="flex items-center justify-center flex-shrink-0 font-semibold text-white bg-blue-900 rounded-full"
    style={{ width: size, height: size, fontSize: size * 0.36 }}
  >
    {getInitials(name)}
  </div>
);

const Announcements: React.FC = () => {
  const { user, workspace } = useAuth();
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

  // Delete Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<
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
      if (Array.isArray(response.data)) setAnnouncements(response.data);
      else if (Array.isArray(response.data.announcements))
        setAnnouncements(response.data.announcements);
      else if (response.data?.announcement)
        setAnnouncements([response.data.announcement]);
      else if (Array.isArray(response.data?.history))
        setAnnouncements(response.data.history);
      else setAnnouncements([]);
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
      setUsers(
        [...response.data].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch (err: any) {
      console.error("Failed to load users", err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    loadUsers();
  }, [workspace?.id]);

  const deleteAnnouncement = (id: number) => {
    setAnnouncementToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    setDeletingAnnouncementId(announcementToDelete);
    setAnnouncementsError(null);
    try {
      await api.delete(`/api/announcements/${announcementToDelete}`);
      setAnnouncements((prev) =>
        prev.filter((a) => a.id !== announcementToDelete),
      );
      setShowDeleteModal(false);
      setAnnouncementToDelete(null);
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
      .map((id) => users.find((u) => u.id === id)?.email)
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
    <div className="flex flex-col min-h-0 overflow-hidden bg-white border rounded-md border-slate-200">
      {/* Top Bar */}
      <div className="flex items-center flex-shrink-0 px-6 py-3 bg-white border-b border-slate-200">
        <Eyebrow>{announcements.length} announcements</Eyebrow>
        {user?.role === "admin" && (
          <button
            onClick={() => setShowForm(true)}
            className="ml-auto bg-slate-900 text-white rounded flex items-center gap-1.5 hover:bg-slate-800 transition-colors"
            style={{ padding: "6px 12px", fontSize: 13 }}
          >
            <Plus className="w-3.5 h-3.5" /> New announcement
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && user?.role === "admin" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-900/45">
          <form
            onSubmit={handleCreateAnnouncement}
            className="w-full max-w-lg bg-white rounded-md border border-slate-200 shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between flex-shrink-0 px-6 py-4 border-b border-slate-200">
              <div>
                <Eyebrow>New Broadcast</Eyebrow>
                <h3 className="font-semibold text-[17px] text-slate-900 mt-0.5">
                  Create Announcement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              {announcementsError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 rounded flex items-center gap-2 text-[13px]">
                  <AlertCircle className="flex-shrink-0 w-4 h-4" />
                  <span>{announcementsError}</span>
                </div>
              )}

              <div>
                <Eyebrow className="mb-1.5">Subject Line</Eyebrow>
                <input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 transition-colors"
                  placeholder="e.g., Office Holiday Update"
                />
              </div>

              <div>
                <Eyebrow className="mb-1.5">Recipient Type</Eyebrow>
                <div className="flex items-center bg-[#EEF1F5] rounded p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTargetType("specific")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                      targetType === "specific"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <UsersIcon className="w-3.5 h-3.5" /> Specific
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("all")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                      targetType === "all"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Everyone
                  </button>
                </div>
              </div>

              {targetType === "specific" && (
                <div>
                  <Eyebrow className="mb-1.5">Select Recipients</Eyebrow>
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-6 border rounded bg-slate-50 border-slate-200">
                      <Loader2 className="w-4 h-4 text-blue-900 animate-spin" />
                    </div>
                  ) : (
                    // Changed max-h-48 to max-h-40 to make the box slightly smaller
                    <div className="overflow-y-auto bg-white border divide-y rounded max-h-40 border-slate-200 divide-slate-100">
                      {users.map((u) => (
                        <label
                          key={u.id}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked)
                                setSelectedUserIds((prev) => [...prev, u.id]);
                              else
                                setSelectedUserIds((prev) =>
                                  prev.filter((id) => id !== u.id),
                                );
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-900 focus:ring-blue-900/20"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-slate-900 truncate">
                              {u.fullName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {u.email}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedUserIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selectedUserIds.map((id) => {
                        const u = users.find((user) => user.id === id);
                        return u ? (
                          <div
                            key={id}
                            className="flex items-center gap-1.5 bg-blue-50 text-blue-900 border border-blue-100 rounded px-2 py-0.5 text-[11px] font-medium"
                          >
                            {u.fullName}
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedUserIds((prev) =>
                                  prev.filter((uid) => uid !== id),
                                )
                              }
                              className="hover:text-blue-700"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <Eyebrow className="mb-1.5">Message</Eyebrow>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded outline-none focus:border-blue-900 resize-none transition-colors"
                  placeholder="Write your message here..."
                />
              </div>
            </div>

            <div className="flex justify-end flex-shrink-0 gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-[13px] font-medium text-slate-600 border border-slate-200 rounded hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-70 transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Send Announcement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAnnouncementToDelete(null);
        }}
        onConfirm={confirmDeleteAnnouncement}
        message="Are you sure you want to remove this announcement?"
      />

      {/* Announcements Feed */}
      <div className="flex-1 overflow-y-auto bg-[#F6F7F9]">
        <div className="max-w-3xl px-6 py-8 mx-auto space-y-4 lg:px-8">
          {announcementsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20">
              <Loader2 className="w-6 h-6 text-blue-900 animate-spin" />
              <div
                className="text-[11px] text-slate-400 tracking-[0.1em] uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Loading announcements
              </div>
            </div>
          ) : announcementsError ? (
            <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded flex items-center gap-3 text-[13px]">
              <AlertCircle className="flex-shrink-0 w-4 h-4" />
              <span>{announcementsError}</span>
            </div>
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-md border-slate-200">
              <div className="flex items-center justify-center w-12 h-12 mb-3 rounded bg-slate-100">
                <Megaphone className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="font-semibold text-[14px] text-slate-900 mb-1">
                No announcements
              </h3>
              <p className="text-slate-500 text-[12px] max-w-xs mx-auto">
                The news board is currently empty. Stay tuned for future
                updates!
              </p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="p-5 bg-white border rounded-md border-slate-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name="EMS System" size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[13px] text-slate-900">
                      System Broadcast
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDate(announcement.createdAt)}
                    </div>
                  </div>
                  <span
                    className="inline-flex items-center rounded bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] tracking-[0.05em] uppercase font-medium flex-shrink-0"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    To:{" "}
                    {announcement.targetType === "all"
                      ? "All Employees"
                      : `${announcement.targetEmails?.length || 0} Recipients`}
                  </span>
                </div>

                <h3 className="font-semibold mb-2 text-[16px] tracking-tight text-slate-900">
                  {announcement.subject}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4 text-[13px] whitespace-pre-wrap">
                  {announcement.message}
                </p>

                {announcement.targetType === "specific" &&
                  announcement.targetEmails &&
                  announcement.targetEmails.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {announcement.targetEmails.map((email, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[11px] text-slate-600"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <span
                    className="text-[11px] text-slate-400"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatDate(announcement.createdAt)}
                  </span>
                  {user?.role === "admin" && (
                    <button
                      onClick={() => deleteAnnouncement(announcement.id)}
                      disabled={deletingAnnouncementId === announcement.id}
                      className="flex items-center gap-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50 rounded px-2 py-1 transition-colors disabled:opacity-50"
                    >
                      {deletingAnnouncementId === announcement.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Announcements;
