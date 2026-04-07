import { useEffect } from "react";
import { useKanbanStore } from "./store/kanban-store";
import { useWebSocket } from "./hooks/useWebSocket";
import { fetchBoard, fetchStats } from "./lib/api";
import { Header } from "./components/Header";
import { Board } from "./components/Board";
import { TaskDetail } from "./components/TaskDetail";
import { CreateTaskDialog } from "./components/CreateTaskDialog";

export function App() {
  const theme = useKanbanStore((s) => s.theme);
  const setTasks = useKanbanStore((s) => s.setTasks);
  const setStats = useKanbanStore((s) => s.setStats);
  const selectedTaskId = useKanbanStore((s) => s.selectedTaskId);
  const showCreateDialog = useKanbanStore((s) => s.showCreateDialog);

  // WebSocket connection
  useWebSocket();

  // Initial data fetch
  useEffect(() => {
    fetchBoard()
      .then((board) => setTasks(board.tasks))
      .catch(() => {
        // API not available yet
      });

    fetchStats()
      .then((stats) => setStats(stats))
      .catch(() => {
        // API not available yet
      });
  }, [setTasks, setStats]);

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
    </div>
  );
}
