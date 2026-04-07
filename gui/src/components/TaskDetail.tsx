import { useState, useCallback, useEffect, useRef } from "react";
import { useKanbanStore } from "../store/kanban-store";
import {
  updateTask as apiUpdateTask,
  completeTask as apiCompleteTask,
  failTask as apiFailTask,
} from "../lib/api";
import type { Column, Subtask } from "../types";
import { COLUMNS, COLUMN_LABELS, COLUMN_COLORS } from "../types";
import { formatDuration, getTaskDuration } from "../lib/time";

export function TaskDetail() {
  const theme = useKanbanStore((s) => s.theme);
  const selectedTaskId = useKanbanStore((s) => s.selectedTaskId);
  const tasks = useKanbanStore((s) => s.tasks);
  const selectTask = useKanbanStore((s) => s.selectTask);
  const updateTaskInStore = useKanbanStore((s) => s.updateTask);
  const deleteTaskAction = useKanbanStore((s) => s.deleteTask);
  const archiveTaskAction = useKanbanStore((s) => s.archiveTaskAction);
  const addToast = useKanbanStore((s) => s.addToast);

  const task = tasks.find((t) => t.id === selectedTaskId);
  const isDark = theme === "dark";

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProgress, setEditProgress] = useState(0);
  const [editColumn, setEditColumn] = useState<Column>("backlog");
  const [editTags, setEditTags] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const savingRef = useRef(false);

  // Only reset form fields when switching to a different task (not on same-task reference changes from WS/fs.watch)
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDesc(task.description);
      setEditProgress(task.progress);
      setEditColumn(task.column);
      setEditTags(task.tags.join(", "));
      setConfirmDelete(false);
    }
  }, [selectedTaskId]);

  const handleSave = useCallback(
    async (field: string, value: unknown) => {
      if (!task || savingRef.current) return;
      savingRef.current = true;
      const previousValue = task[field as keyof typeof task];
      try {
        const payload = { [field]: value };
        const updated = await apiUpdateTask(task.id, payload);
        updateTaskInStore(updated);
        addToast("success", "任務已更新");
      } catch {
        // Revert local state on failure
        if (field === "title") setEditTitle(String(previousValue ?? ""));
        else if (field === "description")
          setEditDesc(String(previousValue ?? ""));
        else if (field === "progress")
          setEditProgress(Number(previousValue ?? 0));
        else if (field === "column")
          setEditColumn((previousValue as Column) ?? "backlog");
        else if (field === "tags")
          setEditTags((previousValue as string[])?.join(", ") ?? "");
        addToast("error", "更新失敗，請稍後再試");
      } finally {
        savingRef.current = false;
      }
    },
    [task, updateTaskInStore, addToast]
  );

  const handleSubtaskToggle = useCallback(
    async (idx: number) => {
      if (!task) return;
      const newSubtasks: Subtask[] = task.subtasks.map((s, i) =>
        i === idx ? { ...s, done: !s.done } : { ...s }
      );
      // Optimistic
      updateTaskInStore({ ...task, subtasks: newSubtasks });
      try {
        const updated = await apiUpdateTask(task.id, {
          subtasks: newSubtasks,
        });
        updateTaskInStore(updated);
      } catch {
        // revert
        updateTaskInStore(task);
        addToast("error", "更新失敗，請稍後再試");
      }
    },
    [task, updateTaskInStore, addToast]
  );

  const handleComplete = useCallback(async () => {
    if (!task || savingRef.current) return;
    savingRef.current = true;
    try {
      const updated = await apiCompleteTask(task.id);
      updateTaskInStore(updated);
      addToast("success", "任務已完成");
      selectTask(null);
    } catch {
      setEditColumn(task.column);
      addToast("error", "操作失敗，請稍後再試");
    } finally {
      savingRef.current = false;
    }
  }, [task, updateTaskInStore, addToast, selectTask]);

  const handleFail = useCallback(async () => {
    if (!task || savingRef.current) return;
    savingRef.current = true;
    try {
      const updated = await apiFailTask(task.id);
      updateTaskInStore(updated);
      addToast("info", "任務已標記失敗");
      selectTask(null);
    } catch {
      setEditColumn(task.column);
      addToast("error", "操作失敗，請稍後再試");
    } finally {
      savingRef.current = false;
    }
  }, [task, updateTaskInStore, addToast, selectTask]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteTaskAction(task.id);
    } catch {
      addToast("error", "刪除失敗，請稍後再試");
      setConfirmDelete(false);
    }
  }, [task, confirmDelete, deleteTaskAction, addToast]);

  const handleArchive = useCallback(async () => {
    if (!task) return;
    try {
      await archiveTaskAction(task.id);
      selectTask(null);
    } catch {
      addToast("error", "歸檔失敗，請稍後再試");
    }
  }, [task, archiveTaskAction, addToast, selectTask]);

  if (!task) return null;

  const panelBg = isDark ? "bg-surface-dark" : "bg-white";
  const borderColor = isDark ? "border-border-dark" : "border-gray-200";
  const textColor = isDark ? "text-text-dark" : "text-text-light";
  const mutedText = isDark ? "text-gray-400" : "text-gray-500";
  const inputBg = isDark
    ? "bg-surface2-dark border-border-dark"
    : "bg-surface2-light border-gray-300";

  // Dependency info (defensive: old tasks may lack dependsOn)
  const depTasks = (task.dependsOn ?? [])
    .map((depId) => {
      const depTask = tasks.find((t) => t.id === depId);
      return depTask
        ? { id: depId, title: depTask.title, done: depTask.column === "done" }
        : { id: depId, title: depId, done: false };
    });

  // Time tracking
  const duration = getTaskDuration(task);
  const durationStr = duration !== null ? formatDuration(duration) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => selectTask(null)}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg z-50 ${panelBg} ${borderColor} border-l shadow-2xl overflow-y-auto`}
      >
        {/* Close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-inherit">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: COLUMN_COLORS[task.column] }}
            />
            {task.archived && (
              <span className={`text-xs ${mutedText}`}>（已歸檔）</span>
            )}
          </div>
          <button
            onClick={() => selectTask(null)}
            className={`p-1 rounded hover:bg-surface2-dark ${textColor}`}
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

        <div className="px-6 py-4 space-y-5">
          {/* Title */}
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              標題
            </label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => {
                if (editTitle !== task.title) handleSave("title", editTitle);
              }}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent`}
            />
          </div>

          {/* Description */}
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              描述
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              onBlur={() => {
                if (editDesc !== task.description)
                  handleSave("description", editDesc);
              }}
              rows={3}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent resize-none`}
            />
          </div>

          {/* Progress */}
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              進度：{editProgress}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={editProgress}
              onChange={(e) => setEditProgress(Number(e.target.value))}
              onMouseUp={() => {
                if (editProgress !== task.progress)
                  handleSave("progress", editProgress);
              }}
              onTouchEnd={() => {
                if (editProgress !== task.progress)
                  handleSave("progress", editProgress);
              }}
              className="w-full accent-accent"
            />
          </div>

          {/* Column */}
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              欄位
            </label>
            <select
              value={editColumn}
              onChange={(e) => {
                const col = e.target.value as Column;
                setEditColumn(col);
                handleSave("column", col);
              }}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent`}
            >
              {COLUMNS.map((c) => (
                <option key={c} value={c}>
                  {COLUMN_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className={`text-xs font-medium ${mutedText} block mb-1`}>
              標籤（逗號分隔）
            </label>
            <input
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              onBlur={() => {
                const tags = editTags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
                const changed =
                  JSON.stringify(tags) !== JSON.stringify(task.tags);
                if (changed) handleSave("tags", tags);
              }}
              className={`w-full px-3 py-2 rounded-lg border text-sm ${inputBg} ${textColor} outline-none focus:border-accent`}
            />
          </div>

          {/* Dependencies */}
          {depTasks.length > 0 && (
            <div>
              <label className={`text-xs font-medium ${mutedText} block mb-2`}>
                依賴任務
              </label>
              <div className="space-y-1.5">
                {depTasks.map((dep) => (
                  <div
                    key={dep.id}
                    className={`flex items-center gap-2 text-sm cursor-pointer ${textColor} hover:opacity-80`}
                    onClick={() => selectTask(dep.id)}
                  >
                    <span>{dep.done ? "✅" : "⏳"}</span>
                    <span
                      className={dep.done ? "line-through opacity-50" : ""}
                    >
                      {dep.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div>
              <label className={`text-xs font-medium ${mutedText} block mb-2`}>
                子任務 ({task.subtasks.filter((s) => s.done).length}/
                {task.subtasks.length})
              </label>
              <div className="space-y-1.5">
                {task.subtasks.map((sub, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-2 text-sm cursor-pointer ${textColor}`}
                  >
                    <input
                      type="checkbox"
                      checked={sub.done}
                      onChange={() => handleSubtaskToggle(idx)}
                      className="accent-accent"
                    />
                    <span className={sub.done ? "line-through opacity-50" : ""}>
                      {sub.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {task.logs.length > 0 && (
            <div>
              <label className={`text-xs font-medium ${mutedText} block mb-2`}>
                記錄
              </label>
              <div
                className={`space-y-2 text-xs max-h-48 overflow-y-auto rounded-lg p-3 ${
                  isDark ? "bg-surface2-dark" : "bg-surface2-light"
                }`}
              >
                {task.logs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className={`shrink-0 ${mutedText}`}>
                      {new Date(log.timestamp).toLocaleString("zh-TW")}
                    </span>
                    <span className={textColor}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {task.result && (
            <div>
              <label className={`text-xs font-medium ${mutedText} block mb-1`}>
                結果
              </label>
              <div
                className={`text-sm rounded-lg p-3 ${
                  isDark ? "bg-surface2-dark" : "bg-surface2-light"
                } ${textColor}`}
              >
                {task.result}
              </div>
            </div>
          )}

          {/* Action buttons: Complete / Fail */}
          {task.column !== "done" && task.column !== "failed" && (
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleComplete}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-col-done hover:opacity-90 transition-opacity"
              >
                完成
              </button>
              <button
                onClick={handleFail}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-col-failed hover:opacity-90 transition-opacity"
              >
                失敗
              </button>
            </div>
          )}

          {/* Archive + Delete buttons */}
          <div className="flex gap-2 pt-1">
            {!task.archived && (
              <button
                onClick={handleArchive}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80 ${
                  isDark
                    ? "border-border-dark text-gray-400"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                歸檔
              </button>
            )}
            <button
              onClick={handleDelete}
              className={`flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 ${
                confirmDelete ? "bg-red-700" : "bg-col-failed"
              }`}
            >
              {confirmDelete ? "確認刪除？" : "刪除"}
            </button>
          </div>

          {/* Meta info */}
          <div
            className={`text-xs space-y-1 pt-2 border-t ${borderColor} ${mutedText}`}
          >
            <div>ID: {task.id}</div>
            <div>
              建立時間: {new Date(task.createdAt).toLocaleString("zh-TW")}
            </div>
            {task.startedAt && (
              <div>
                開始時間: {new Date(task.startedAt).toLocaleString("zh-TW")}
              </div>
            )}
            {task.completedAt && (
              <div>
                完成時間: {new Date(task.completedAt).toLocaleString("zh-TW")}
              </div>
            )}
            {durationStr && <div>耗時: ⏱ {durationStr}</div>}
            <div>來源: {task.source}</div>
            <div>類型: {task.taskType}</div>
          </div>
        </div>
      </div>
    </>
  );
}
