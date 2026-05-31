import React, { useEffect, useState } from "react";
import {
  Plus,
  CheckSquare,
  Edit2,
  Trash2,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import api from "../api/axios";

type MyTask = {
  id: number;
  title: string;
  description?: string;
  dueDate?: string;
  status: "pending" | "completed";
  createdAt: string;
};

const MyTasks: React.FC = () => {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [editingTask, setEditingTask] = useState<MyTask | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<MyTask[]>("/api/mytasks");
      setTasks(response.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Unable to load tasks.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setEditingTask(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingTask) {
        const response = await api.put<any>(`/api/mytasks/${editingTask.id}`, {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
        });
        setTasks((prev) =>
          prev.map((t) => (t.id === editingTask.id ? response.data.task : t)),
        );
      } else {
        const response = await api.post<any>("/api/mytasks", {
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
        });
        setTasks((prev) => [response.data.task, ...prev]);
      }
      resetForm();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || err.message || "Unable to save task.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (task: MyTask) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setError(null);
  };

  const handleDelete = async (taskId: number) => {
    const ok = window.confirm("Delete this personal task?");
    if (!ok) return;

    try {
      await api.delete(`/api/mytasks/${taskId}`);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err: any) {
      alert(
        err?.response?.data?.message || err.message || "Unable to delete task.",
      );
    }
  };

  const toggleStatus = async (task: MyTask) => {
    try {
      const newStatus = task.status === "completed" ? "pending" : "completed";
      const response = await api.put<any>(`/api/mytasks/${task.id}`, {
        status: newStatus,
      });
      setTasks((prev) =>
        prev.map((item) => (item.id === task.id ? response.data.task : item)),
      );
    } catch (err: any) {
      alert(
        err?.response?.data?.message || err.message || "Unable to update task.",
      );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">My Task List</h2>
            <p className="text-sm text-slate-500 mt-1">
              A personal list of tasks only visible to your account.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-3xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            <CheckSquare className="w-4 h-4 text-indigo-600" />
            Personal To-Do
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-4 md:grid-cols-[1.8fr_1fr]"
        >
          <div className="space-y-4">
            {error && (
              <div className="rounded-3xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700">
                {error}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="What do you need to do?"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Add extra context or reminders"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">
                Quick actions
              </p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Add a task to your personal list. Edit or delete items anytime.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {editingTask && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-full px-5 py-3 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="w-full px-5 py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-70"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </span>
                ) : editingTask ? (
                  "Update Task"
                ) : (
                  "Add Task"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center">
            <Loader2 className="mx-auto w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-slate-500">
              Loading your personal tasks...
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Plus className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              No personal tasks yet
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Create a task above to keep track of your own work.
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${
                        task.status === "completed"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "bg-amber-100 text-amber-700 border border-amber-200"
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {task.status === "completed" ? "Completed" : "Pending"}
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-right">
                  <button
                    onClick={() => toggleStatus(task)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    <CheckSquare className="w-4 h-4" />
                    {task.status === "completed" ? "Mark Pending" : "Mark Done"}
                  </button>
                  <button
                    onClick={() => handleEdit(task)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyTasks;
