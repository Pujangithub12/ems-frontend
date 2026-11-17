import React, { useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { getErrorMessage } from "../../../lib/errors";
import {
  useTaskProgressUpdates,
  useAddTaskProgressUpdate,
  useAddTaskProgressFeedback,
  useAddStandaloneTaskFeedback,
} from "../hooks/useTaskProgressUpdates";

type Props = {
  taskId: number;
  /** Assignees write the progress text. */
  canWrite: boolean;
  /** The person who assigned the task may reply with feedback. */
  canGiveFeedback: boolean;
};

/**
 * Task-level progress log shown inside the "Show Feedback" popup: the assignee
 * writes progress as free text, and the assigner can optionally answer each
 * entry with feedback.
 */
const TaskProgressUpdates: React.FC<Props> = ({ taskId, canWrite, canGiveFeedback }) => {
  const updatesQuery = useTaskProgressUpdates(taskId);
  const addUpdate = useAddTaskProgressUpdate(taskId);
  const addFeedback = useAddTaskProgressFeedback(taskId);
  const addStandalone = useAddStandaloneTaskFeedback(taskId);

  const [draft, setDraft] = useState("");
  const [standaloneDraft, setStandaloneDraft] = useState("");
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  // Newest first.
  const updates = [...(updatesQuery.data ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const postUpdate = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    try {
      await addUpdate.mutateAsync(text);
      setDraft("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to post progress update."));
    }
  };

  const postStandaloneFeedback = async () => {
    const text = standaloneDraft.trim();
    if (!text) return;
    setError(null);
    try {
      await addStandalone.mutateAsync(text);
      setStandaloneDraft("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add feedback."));
    }
  };

  const sendFeedback = async (commentId: number) => {
    const text = (feedbackDrafts[commentId] || "").trim();
    if (!text) return;
    setError(null);
    try {
      await addFeedback.mutateAsync({ commentId, feedback: text });
      setFeedbackDrafts((prev) => ({ ...prev, [commentId]: "" }));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add feedback."));
    }
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div className="p-3 border rounded-lg border-slate-200 bg-white">
          <label className="block mb-1.5 text-[11px] font-semibold text-slate-600">
            Write your progress
          </label>
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Describe what you've done so far..."
            className="w-full px-3 py-2 text-[12px] bg-slate-50 rounded-lg border border-slate-200 outline-none resize-y focus:bg-white focus:border-blue-400 transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={postUpdate}
              disabled={!draft.trim() || addUpdate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addUpdate.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Post update
            </button>
          </div>
        </div>
      )}

      {canGiveFeedback && (
        <div className="p-3 border rounded-lg border-slate-200 bg-white">
          <label className="block mb-1.5 text-[11px] font-semibold text-slate-600">
            Give feedback
          </label>
          <textarea
            rows={2}
            value={standaloneDraft}
            onChange={(e) => setStandaloneDraft(e.target.value)}
            placeholder="Write feedback for the assignee..."
            className="w-full px-3 py-2 text-[12px] bg-slate-50 rounded-lg border border-slate-200 outline-none resize-y focus:bg-white focus:border-blue-400 transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={postStandaloneFeedback}
              disabled={!standaloneDraft.trim() || addStandalone.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addStandalone.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Send feedback
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="px-3 py-2 text-[12px] text-red-700 border border-red-200 rounded-lg bg-red-50">{error}</p>
      )}

      {updatesQuery.isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-blue-900 animate-spin" />
        </div>
      ) : updatesQuery.isError ? (
        <p className="py-4 text-center text-[12px] text-red-600">
          {getErrorMessage(updatesQuery.error, "Unable to load progress updates.")}
        </p>
      ) : updates.length === 0 ? (
        <p className="py-4 text-center text-slate-400 text-[12px]">
          {canWrite
            ? "You haven't written any progress on this task yet."
            : "No progress or feedback has been written on this task yet."}
        </p>
      ) : (
        updates.map((u) => (
          <div key={u.id} className="p-3 border rounded-lg border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[11px] font-semibold text-blue-900 truncate">
                {u.author?.fullName || "Unknown"}
              </span>
              <span
                className="flex-shrink-0 text-[10px] text-slate-400"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {new Date(u.createdAt).toLocaleString()}
              </span>
            </div>
            {u.commentText && (
              <p className="text-[12px] text-slate-700 whitespace-pre-wrap">{u.commentText}</p>
            )}
            {u.feedback ? (
              <div className="flex items-start gap-2 p-2 mt-2 bg-white border rounded-lg border-slate-200">
                <MessageSquare className="flex-shrink-0 w-3.5 h-3.5 mt-0.5 text-emerald-700" />
                <p className="text-[12px] text-slate-800 whitespace-pre-wrap">{u.feedback}</p>
              </div>
            ) : (
              canGiveFeedback && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Add feedback..."
                    value={feedbackDrafts[u.id] || ""}
                    onChange={(e) => setFeedbackDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendFeedback(u.id);
                    }}
                    className="flex-1 px-3 py-1.5 text-[12px] bg-slate-50 rounded-lg border border-slate-200 outline-none focus:bg-white focus:border-blue-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => sendFeedback(u.id)}
                    disabled={!(feedbackDrafts[u.id] || "").trim() || addFeedback.isPending}
                    className="px-3 py-1.5 text-[12px] font-medium text-white bg-blue-900 rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default TaskProgressUpdates;
