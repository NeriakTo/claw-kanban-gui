import { useEffect, useRef } from "react";
import type { BoardEvent } from "../types";
import { useKanbanStore } from "../store/kanban-store";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setTasks,
    setStats,
    addTask,
    updateTask,
    moveTask,
    removeTask,
    setWsConnected,
  } = useKanbanStore();

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        setWsConnected(true);
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      });

      ws.addEventListener("close", () => {
        setWsConnected(false);
        wsRef.current = null;
        reconnectTimer.current = setTimeout(connect, 3000);
      });

      ws.addEventListener("error", () => {
        ws.close();
      });

      ws.addEventListener("message", (ev) => {
        try {
          const raw: unknown = JSON.parse(String(ev.data));
          if (typeof raw !== "object" || raw === null || !("type" in raw)) return;
          const event = raw as BoardEvent;
          switch (event.type) {
            case "full_refresh":
              if (event.board?.tasks) setTasks(event.board.tasks);
              break;
            case "task_created":
              if (event.task?.id) addTask(event.task);
              break;
            case "task_updated":
              if (event.task?.id) updateTask(event.task);
              break;
            case "task_moved":
              if (event.taskId && event.from && event.to) moveTask(event.taskId, event.from, event.to);
              break;
            case "task_deleted":
              if (event.taskId) removeTask(event.taskId);
              break;
            case "board_synced":
              if (event.stats) setStats(event.stats);
              break;
          }
        } catch {
          // ignore malformed messages
        }
      });
    }

    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
    };
  }, [
    setTasks,
    setStats,
    addTask,
    updateTask,
    moveTask,
    removeTask,
    setWsConnected,
  ]);
}
