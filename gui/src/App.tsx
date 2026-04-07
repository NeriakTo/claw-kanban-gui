import { useEffect, useCallback } from "react";
import { useKanbanStore } from "./store/kanban-store";
import { useWebSocket } from "./hooks/useWebSocket";
import { fetchBoard, fetchStats } from "./lib/api";
import { Header } from "./components/Header";
import { Board } from "./components/Board";
import { TaskDetail } from "./components/TaskDetail";
import { CreateTaskDialog } from "./components/CreateTaskDialog";
import { ToastContainer } from "./components/Toast";

export function App() {
  const theme = useKanbanStore((s) => s.theme);
  const setTasks = useKanbanStore((s) => s.setTasks);
  const setStats = useKanbanStore((s) => s.setStats);
  const selectedTaskId = useKanbanStore((s) => s.selectedTaskId);
  const showCreateDialog = useKanbanStore((s) => s.showCreateDialog);
  const selectTask = useKanbanStore((s) => s.selectTask);
  const setShowCreateDialog = useKanbanStore((s) => s.setShowCreateDialog);
  const addToast = useKanbanStore((s) => s.addToast);

  // WebSocket connection
  useWebSocket();

  // Initial data fetch
  useEffect(() => {
    fetchBoard()
      .then((board) => setTasks(board.tasks))
      .catch(() => {
        addToast("error", "無法載入看板資料");
      });

    fetchStats()
      .then((stats) => setStats(stats))
      .catch(() => {
        // Stats fetch is non-critical
      });
  }, [setTasks, setStats, addToast]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Escape — close detail / create dialog
      if (e.key === "Escape") {
        if (showCreateDialog) {
          setShowCreateDialog(false);
          return;
        }
        if (selectedTaskId) {
          selectTask(null);
          return;
        }
      }

      // Skip other shortcuts when input is focused
      if (isInputFocused) return;

      // "/" — focus search
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("kanban-search-input");
        if (searchInput) {
          searchInput.focus();
        }
      }

      // "n" — open create dialog
      if (e.key === "n") {
        e.preventDefault();
        setShowCreateDialog(true);
      }
    },
    [showCreateDialog, selectedTaskId, selectTask, setShowCreateDialog]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={`h-screen flex flex-col ${
        theme === "dark"
          ? "theme-dark bg-bg-dark text-text-dark"
          : "theme-light bg-bg-light text-text-light"
      }`}
    >
      <Header />
      <Board />

      {selectedTaskId && <TaskDetail />}
      {showCreateDialog && <CreateTaskDialog />}
      <ToastContainer />
    </div>
  );
}
