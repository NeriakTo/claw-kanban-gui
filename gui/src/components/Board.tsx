import { useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import { useState } from "react";
import { useKanbanStore } from "../store/kanban-store";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { moveTask as apiMoveTask } from "../lib/api";
import { COLUMNS, type Column as ColumnType, type Task } from "../types";

function matchesSearch(task: Task, query: string): boolean {
  const q = query.toLowerCase();
  return (
    task.title.toLowerCase().includes(q) ||
    task.description.toLowerCase().includes(q) ||
    task.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}

function sortTasks(
  tasks: Task[],
  sortBy: "date" | "progress" | "name"
): Task[] {
  const sorted = [...tasks];
  switch (sortBy) {
    case "date":
      sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      break;
    case "progress":
      sorted.sort((a, b) => b.progress - a.progress);
      break;
    case "name":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-TW"));
      break;
  }
  return sorted;
}

export function Board() {
  const theme = useKanbanStore((s) => s.theme);
  const tasks = useKanbanStore((s) => s.tasks);
  const moveTaskInStore = useKanbanStore((s) => s.moveTask);
  const updateTaskInStore = useKanbanStore((s) => s.updateTask);
  const addToast = useKanbanStore((s) => s.addToast);
  const searchQuery = useKanbanStore((s) => s.searchQuery);
  const filterTags = useKanbanStore((s) => s.filterTags);
  const showArchived = useKanbanStore((s) => s.showArchived);
  const sortBy = useKanbanStore((s) => s.sortBy);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Filter archived
    if (!showArchived) {
      result = result.filter((t) => !t.archived);
    }

    // Search query
    if (searchQuery.trim()) {
      result = result.filter((t) => matchesSearch(t, searchQuery));
    }

    // Column filters (tags starting with "col:")
    const colFilters = filterTags
      .filter((t) => t.startsWith("col:"))
      .map((t) => t.replace("col:", ""));
    if (colFilters.length > 0) {
      result = result.filter((t) => colFilters.includes(t.column));
    }

    // Tag filters (non-column tags)
    const tagFilters = filterTags.filter((t) => !t.startsWith("col:"));
    if (tagFilters.length > 0) {
      result = result.filter((t) =>
        tagFilters.some((tag) => t.tags.includes(tag))
      );
    }

    return result;
  }, [tasks, searchQuery, filterTags, showArchived]);

  const tasksByColumn = useMemo(() => {
    return COLUMNS.reduce(
      (acc, col) => {
        const colTasks = filteredTasks.filter((t) => t.column === col);
        acc[col] = sortTasks(colTasks, sortBy);
        return acc;
      },
      {} as Record<ColumnType, Task[]>
    );
  }, [filteredTasks, sortBy]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      if (task) setActiveTask(task);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Determine target column
      let targetColumn: ColumnType | null = null;

      // Dropped on a column droppable
      const overData = over.data.current as { column?: ColumnType } | undefined;
      if (overData?.column) {
        targetColumn = overData.column;
      } else {
        // Dropped on another task — find which column that task is in
        const overTask = tasks.find((t) => t.id === over.id);
        if (overTask) {
          targetColumn = overTask.column;
        }
      }

      if (!targetColumn || targetColumn === task.column) return;

      // Optimistic update
      moveTaskInStore(taskId, task.column, targetColumn);

      try {
        const updated = await apiMoveTask(taskId, targetColumn);
        updateTaskInStore(updated);
        addToast("success", "任務已移動");
      } catch {
        // Revert
        moveTaskInStore(taskId, targetColumn, task.column);
        addToast("error", "移動失敗，請稍後再試");
      }
    },
    [tasks, moveTaskInStore, updateTaskInStore, addToast]
  );

  return (
    <div
      className={`flex-1 overflow-x-auto p-4 ${
        theme === "dark" ? "bg-bg-dark" : "bg-bg-light"
      }`}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 min-h-full">
          {COLUMNS.map((col) => (
            <Column key={col} column={col} tasks={tasksByColumn[col]} />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
