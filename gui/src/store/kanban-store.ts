import { create } from "zustand";
import type { BoardStats, Column, Task } from "../types";

interface KanbanState {
  tasks: Task[];
  stats: BoardStats | null;
  selectedTaskId: string | null;
  showCreateDialog: boolean;
  theme: "dark" | "light";
  wsConnected: boolean;

  // Actions
  setTasks: (tasks: Task[]) => void;
  setStats: (stats: BoardStats) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;
  moveTask: (taskId: string, from: Column, to: Column) => void;
  removeTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  setShowCreateDialog: (show: boolean) => void;
  toggleTheme: () => void;
  setWsConnected: (connected: boolean) => void;
}

export const useKanbanStore = create<KanbanState>((set) => ({
  tasks: [],
  stats: null,
  selectedTaskId: null,
  showCreateDialog: false,
  theme:
    (typeof localStorage !== "undefined"
      ? (localStorage.getItem("claw-kanban-theme") as "dark" | "light")
      : null) ?? "dark",
  wsConnected: false,

  setTasks: (tasks) => set({ tasks }),

  setStats: (stats) => set({ stats }),

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  updateTask: (task) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
    })),

  moveTask: (taskId, _from, to) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, column: to } : t
      ),
    })),

  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      selectedTaskId:
        state.selectedTaskId === taskId ? null : state.selectedTaskId,
    })),

  selectTask: (taskId) => set({ selectedTaskId: taskId }),

  setShowCreateDialog: (show) => set({ showCreateDialog: show }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      localStorage.setItem("claw-kanban-theme", next);
      return { theme: next };
    }),

  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
