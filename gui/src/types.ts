export type Column = "backlog" | "in_progress" | "review" | "done" | "failed";

export interface Subtask {
  title: string;
  done: boolean;
}

export interface TaskLog {
  timestamp: string;
  message: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  column: Column;
  progress: number;
  tags: string[];
  subtasks: Subtask[];
  taskType: "general" | "seo" | "edm";
  sessionId: string | null;
  source: "agent" | "sync";
  result: string | null;
  logs: TaskLog[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dependsOn: string[];
  archived: boolean;
}

export interface Board {
  version: number;
  tasks: Task[];
  lastSyncAt: string | null;
}

export interface BoardStats {
  total: number;
  byColumn: Record<Column, number>;
  completedToday: number;
  completedThisWeek: number;
  avgCompletionTimeMs: number | null;
  topTags: { tag: string; count: number }[];
  activeSessionCount: number;
}

export type BoardEvent =
  | { type: "task_created"; task: Task }
  | { type: "task_updated"; task: Task }
  | { type: "task_moved"; taskId: string; from: Column; to: Column }
  | { type: "task_deleted"; taskId: string }
  | { type: "board_synced"; stats: BoardStats }
  | { type: "full_refresh"; board: Board };

export const COLUMNS: readonly Column[] = [
  "backlog",
  "in_progress",
  "review",
  "done",
  "failed",
] as const;

export const COLUMN_LABELS: Record<Column, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  failed: "Failed",
};

export const COLUMN_COLORS: Record<Column, string> = {
  backlog: "#71717a",
  in_progress: "#3b82f6",
  review: "#eab308",
  done: "#22c55e",
  failed: "#ef4444",
};
