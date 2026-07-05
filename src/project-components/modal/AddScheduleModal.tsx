import React, { useEffect, useState } from "react";
import { Plus, Trash2, X, AlertCircle } from "lucide-react";
import { ScheduleRow, emptyScheduleRow } from "../schema/Scheduletypes";

interface AddScheduleModalProps {
  open: boolean;
  initialRows: ScheduleRow[];
  onClose: () => void;
  /** Called with the validated rows when the user clicks Save. Throw to keep the modal open and show an error. */
  onSave: (rows: ScheduleRow[]) => Promise<void>;
}

type Field = keyof ScheduleRow;

const COLUMNS: {
  field: Field;
  label: string;
  type: "text" | "number" | "date";
  width: string;
  placeholder?: string;
}[] = [
  { field: "id", label: "ID", type: "text", width: "w-20", placeholder: "1.1" },
  {
    field: "taskName",
    label: "Task Name",
    type: "text",
    width: "min-w-[180px]",
    placeholder: "Task name",
  },
  {
    field: "duration",
    label: "Duration (days)",
    type: "number",
    width: "w-32",
  },
  { field: "startDate", label: "Start Date", type: "date", width: "w-40" },
  {
    field: "progress",
    label: "Progress (%)",
    type: "number",
    width: "w-28",
    placeholder: "0-100",
  },
  {
    field: "parentId",
    label: "Parent ID",
    type: "text",
    width: "w-28",
    placeholder: "optional",
  },
  {
    field: "predecessorId",
    label: "Predecessor ID",
    type: "text",
    width: "w-36",
    placeholder: "1, 2",
  },
];

const AddScheduleModal: React.FC<AddScheduleModalProps> = ({
  open,
  initialRows,
  onClose,
  onSave,
}) => {
  const [rows, setRows] = useState<ScheduleRow[]>(
    initialRows.length > 0 ? initialRows : [emptyScheduleRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset the working copy whenever the modal is (re)opened.
  useEffect(() => {
    if (open) {
      setRows(initialRows.length > 0 ? initialRows : [emptyScheduleRow()]);
      setError(null);
      setSaving(false);
    }
  }, [open, initialRows]);

  if (!open) return null;

  const updateCell = (index: number, field: Field, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyScheduleRow()]);

  const removeRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    setError(null);

    const meaningfulRows = rows.filter(
      (r) => r.taskName.trim() !== "" || r.id.trim() !== "",
    );
    if (meaningfulRows.length === 0) {
      setError("Add at least one task with a Task Name.");
      return;
    }
    const missingName = meaningfulRows.find((r) => r.taskName.trim() === "");
    if (missingName) {
      setError("Every row needs a Task Name.");
      return;
    }
    const ids = meaningfulRows.map((r) => r.id.trim()).filter(Boolean);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length > 0) {
      setError(
        `Duplicate ID(s): ${Array.from(new Set(dupes)).join(", ")}. IDs must be unique.`,
      );
      return;
    }
    const badDuration = meaningfulRows.find(
      (r) => r.duration.trim() !== "" && Number.isNaN(Number(r.duration)),
    );
    if (badDuration) {
      setError(`Duration for "${badDuration.taskName}" must be a number.`);
      return;
    }
    const badProgress = meaningfulRows.find((r) => {
      if (r.progress.trim() === "") return false;
      const n = Number(r.progress);
      return Number.isNaN(n) || n < 0 || n > 100;
    });
    if (badProgress) {
      setError(`Progress for "${badProgress.taskName}" must be a number between 0 and 100.`);
      return;
    }

    setSaving(true);
    try {
      await onSave(meaningfulRows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save the schedule.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="flex fixed inset-0 z-50 justify-center items-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex flex-col w-full max-w-5xl bg-white rounded-lg shadow-xl max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">
              Add Schedule
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fill in tasks below. Leave Start Date/Duration blank and reference
              the row via Parent ID on other rows to create a summary bar.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-auto px-5 py-4 grow">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs text-left border-b text-slate-500 border-slate-200">
                {COLUMNS.map((col) => (
                  <th
                    key={col.field}
                    className={`px-2 py-2 font-medium ${col.width}`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-b border-slate-100">
                  {COLUMNS.map((col) => (
                    <td key={col.field} className="px-2 py-1.5">
                      <input
                        type={col.type}
                        value={row[col.field]}
                        placeholder={col.placeholder}
                        onChange={(e) =>
                          updateCell(index, col.field, e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-sm border rounded border-slate-200 focus:outline-none focus:border-blue-900"
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      aria-label="Remove row"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            onClick={addRow}
            type="button"
            className="flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-medium text-blue-900 border border-dashed border-blue-200 rounded hover:bg-blue-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Row
          </button>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-between items-center px-5 py-4 border-t border-slate-200">
          <div className="flex gap-2 items-center text-xs text-rose-700">
            {error && (
              <>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-sm rounded border text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddScheduleModal;
