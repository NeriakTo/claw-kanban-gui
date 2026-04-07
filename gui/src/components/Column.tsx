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

export function Column({ column, tasks }: ColumnProps) {
  const theme = useKanbanStore((s) => s.theme);
  const isDark = theme === "dark";

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column}`,
    data: { column },
  });

  const taskIds = tasks.map((t) => t.id);

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
            isDark ? "bg-surface2-dark text-gray-400" : "bg-gray-200 text-gray-600"
          }`}
        >
          {tasks.length}
        </span>
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
