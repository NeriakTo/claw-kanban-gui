import { create } from "zustand";
import type { BoardStats, Column, Task } from "../types";
import {
  deleteTask as apiDeleteTask,
  archiveTask as apiArchiveTask,
} from "../lib/api";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface KanbanState {
  tasks: Task[];
  stats: BoardStats | null;
  selectedTaskId: string | null;
  showCreateDialog: boolean;
  theme: "dark" | "light";
  wsConnected: boolean;

  // Search & Filter
  searchQuery: string;
  filterTags: string[];
  showArchived: boolean;

  // Sort
  sortBy: "date" | "progress" | "name";

  // Toast
  toasts: ToastItem[];

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

  // Search & Filter actions
  setSearchQuery: (query: string) => void;
  toggleFilterTag: (tag: string) => void;
  setShowArchived: (show: boolean) => void;

  // Sort actions
  setSortBy: (sort: "date" | "progress" | "name") => void;

  // Delete / Archive actions
  deleteTask: (id: string) => Promise<void>;
  archiveTaskAction: (id: string) => Promise<void>;

  // Toast actions
  addToast: (type: "success" | "error" | "info", message: string) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;

export const useKanbanStore = create<KanbanState>((set, get) => ({
  tasks: [],
  stats: null,
  selectedTaskId: null,
  showCreateDialog: false,
  theme:
    (typeof localStorage !== "undefined"
      ? (localStorage.getItem("claw-kanban-theme") as "dark" | "light")
      : null) ?? "dark",
  wsConnected: false,

  // Search & Filter
  searchQuery: "",
  filterTags: [],
  showArchived: false,

  // Sort
  sortBy: "date",

  // Toast
  toasts: [],

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

  // Search & Filter actions
  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleFilterTag: (tag) =>
    set((state) => ({
      filterTags: state.filterTags.includes(tag)
        ? state.filterTags.filter((t) => t !== tag)
        : [...state.filterTags, tag],
    })),

  setShowArchived: (show) => set({ showArchived: show }),

  // Sort actions
  setSortBy: (sort) => set({ sortBy: sort }),

  // Delete task
  deleteTask: async (id) => {
    try {
      await apiDeleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        selectedTaskId:
          state.selectedTaskId === id ? null : state.selectedTaskId,
      }));
      get().addToast("success", "任務已刪除");
    } catch {
      get().addToast("error", "刪除失敗，請稍後再試");
    }
  },

  // Archive task
  archiveTaskAction: async (id) => {
    try {
      const updated = await apiArchiveTask(id);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
      get().addToast("success", "任務已歸檔");
    } catch {
      get().addToast("error", "歸檔失敗，請稍後再試");
    }
  },

  // Toast actions
  addToast: (type, message) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }));
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
