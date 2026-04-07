import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../types";
import { useKanbanStore } from "../store/kanban-store";
import { COLUMN_COLORS } from "../types";

interface TaskCardProps {
  task: Task;
}

const TAG_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-teal-500/20 text-teal-400",
  "bg-orange-500/20 text-orange-400",
  "bg-pink-500/20 text-pink-400",
  "bg-cyan-500/20 text-cyan-400",
];

const TAG_COLORS_LIGHT = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
];

function hashTagIndex(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = (h * 31 + tag.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % TAG_COLORS.length;
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return "#22c55e";
  if (progress >= 50) return "#eab308";
  if (progress >= 20) return "#3b82f6";
  return "#71717a";
}

export function TaskCard({ task }: TaskCardProps) {
  const theme = useKanbanStore((s) => s.theme);
  const selectTask = useKanbanStore((s) => s.selectTask);
  const isDark = theme === "dark";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const subtasksDone = task.subtasks.filter((s) => s.done).length;
  const subtasksTotal = task.subtasks.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => selectTask(task.id)}
      className={`rounded-lg p-3 cursor-pointer border transition-colors ${
        isDark
          ? "bg-surface2-dark border-border-dark hover:border-gray-500"
          : "bg-white border-gray-200 hover:border-gray-400"
      }`}
    >
      {/* Title */}
      <h3
        className={`font-semibold text-sm mb-2 line-clamp-2 ${
          isDark ? "text-text-dark" : "text-text-light"
        }`}
      >
        {task.title}
      </h3>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="mb-2">
          <div
            className={`h-1.5 rounded-full overflow-hidden ${
              isDark ? "bg-gray-700" : "bg-gray-200"
            }`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${task.progress}%`,
                backgroundColor: getProgressColor(task.progress),
              }}
            />
          </div>
          <span
            className={`text-xs mt-0.5 inline-block ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            {task.progress}%
          </span>
        </div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => {
            const idx = hashTagIndex(tag);
            const colorClass = isDark
              ? TAG_COLORS[idx]
              : TAG_COLORS_LIGHT[idx];
            return (
              <span
                key={tag}
                className={`text-xs px-1.5 py-0.5 rounded-full ${colorClass}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Subtasks + column indicator */}
      <div className="flex items-center justify-between">
        {subtasksTotal > 0 && (
          <span
            className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
          >
            {subtasksDone}/{subtasksTotal} subtasks
          </span>
        )}
        <span
          className="inline-block h-2 w-2 rounded-full ml-auto"
          style={{ backgroundColor: COLUMN_COLORS[task.column] }}
        />
      </div>
    </div>
  );
}
