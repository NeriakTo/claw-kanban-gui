import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { Column as ColumnType, Task } from "../types";
import { COLUMN_COLORS, COLUMN_LABELS } from "../types";
import { TaskCard } from "./TaskCard";
import { useKanbanStore } from "../store/kanban-store";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
}

const SORT_LABELS: Record<string, string> = {
  date: "最新",
  progress: "進度",
  name: "名稱",
};

const SORT_OPTIONS: Array<"date" | "progress" | "name"> = [
  "date",
  "progress",
  "name",
];

export function Column({ column, tasks }: ColumnProps) {
  const theme = useKanbanStore((s) => s.theme);
  const sortBy = useKanbanStore((s) => s.sortBy);
  const setSortBy = useKanbanStore((s) => s.setSortBy);
  const isDark = theme === "dark";

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column}`,
    data: { column },
  });

  const taskIds = tasks.map((t) => t.id);

  const handleCycleSort = () => {
    const currentIdx = SORT_OPTIONS.indexOf(sortBy);
    const nextIdx = (currentIdx + 1) % SORT_OPTIONS.length;
    setSortBy(SORT_OPTIONS[nextIdx]);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] rounded-xl border transition-colors ${
        isDark
          ? "bg-surface-dark border-border-dark"
          : "bg-surface2-light border-gray-200"
      } ${isOver ? (isDark ? "border-accent" : "border-accent") : ""}`}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-inherit">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: COLUMN_COLORS[column] }}
        />
        <span
          className={`font-semibold text-sm ${
            isDark ? "text-text-dark" : "text-text-light"
          }`}
        >
          {COLUMN_LABELS[column]}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded-md ${
            isDark
              ? "bg-surface2-dark text-gray-400"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {tasks.length}
        </span>

        {/* Sort button */}
        <button
          onClick={handleCycleSort}
          className={`ml-auto text-xs px-1.5 py-0.5 rounded transition-colors ${
            isDark
              ? "text-gray-400 hover:text-text-dark hover:bg-surface2-dark"
              : "text-gray-500 hover:text-text-light hover:bg-gray-200"
          }`}
          title={`排序：${SORT_LABELS[sortBy]}`}
        >
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 16 4 4 4-4" />
              <path d="M7 20V4" />
              <path d="m21 8-4-4-4 4" />
              <path d="M17 4v16" />
            </svg>
            {SORT_LABELS[sortBy]}
          </span>
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div
              className={`text-center py-8 text-sm ${
                isDark ? "text-gray-500" : "text-gray-400"
              }`}
            >
              無任務
            </div>
          ) : (
            tasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
