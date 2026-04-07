import { useCallback } from "react";
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

export function Board() {
  const theme = useKanbanStore((s) => s.theme);
  const tasks = useKanbanStore((s) => s.tasks);
  const moveTaskInStore = useKanbanStore((s) => s.moveTask);
  const updateTaskInStore = useKanbanStore((s) => s.updateTask);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const tasksByColumn = COLUMNS.reduce(
    (acc, col) => {
      acc[col] = tasks.filter((t) => t.column === col);
      return acc;
    },
    {} as Record<ColumnType, Task[]>
  );

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
      } catch {
        // Revert
        moveTaskInStore(taskId, targetColumn, task.column);
      }
    },
    [tasks, moveTaskInStore, updateTaskInStore]
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
