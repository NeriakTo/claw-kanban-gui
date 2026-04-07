import { useState, useCallback, type FormEvent } from "react";
import { useKanbanStore } from "../store/kanban-store";
import { createTask } from "../lib/api";
import type { Column } from "../types";
import { COLUMNS, COLUMN_LABELS } from "../types";

export function CreateTaskDialog() {
  const theme = useKanbanStore((s) => s.theme);
  const showCreateDialog = useKanbanStore((s) => s.showCreateDialog);
  const setShowCreateDialog = useKanbanStore((s) => s.setShowCreateDialog);
  const addTask = useKanbanStore((s) => s.addTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [column, setColumn] = useState<Column>("backlog");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isDark = theme === "dark";

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!title.trim() || submitting) return;

      setSubmitting(true);
      try {
        const tagList = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const task = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          column,
          tags: tagList.length > 0 ? tagList : undefined,
        });
        addTask(task);
        setTitle("");
        setDescription("");
        setColumn("backlog");
        setTags("");
        setShowCreateDialog(false);
      } catch {
        // keep dialog open on error
      } finally {
        setSubmitting(false);
      }
    },
    [
      title,
      description,
      column,
      tags,
      submitting,
      addTask,
      setShowCreateDialog,
    ]
  );

  if (!showCreateDialog) return null;

  const overlayBg = "bg-black/50";
  const panelBg = isDark ? "bg-surface-dark" : "bg-white";
  const borderColor = isDark ? "border-border-dark" : "border-gray-200";
  const textColor = isDark ? "text-text-dark" : "text-text-light";
  const mutedText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-surface2-dark border-border-dark"
    : "bg-surface2-light border-gray-300";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${overlayBg}`}
      onClick={() => setShowCreateDialog(false)}
    >
      <div
        className={`w-full max-w-md rounded-xl ${panelBg} ${borderColor} border shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${borderColor}`}
        >
          <h2 className={`text-lg font-semibold ${textColor}`}>新增任務</h2>
          <button
            onClick={() => setShowCreateDialog(false)}
            className={`p-1 rounded hover:opacity-70 ${textColor}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              標題 *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="輸入任務標題..."
              required
              autoFocus
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent placeholder:${mutedText}`}
            />
          </div>

          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="輸入任務描述..."
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent resize-none placeholder:${mutedText}`}
            />
          </div>

          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              欄位
            </label>
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value as Column)}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent`}
            >
              {COLUMNS.map((c) => (
                <option key={c} value={c}>
                  {COLUMN_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              標籤（逗號分隔）
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：urgent, frontend, bug"
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent placeholder:${mutedText}`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateDialog(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border ${borderColor} ${textColor} hover:opacity-80 transition-opacity`}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-accent hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "建立中..." : "建立"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
