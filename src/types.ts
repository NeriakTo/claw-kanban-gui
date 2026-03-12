// ─── Kanban Column ───

export type Column = "backlog" | "in_progress" | "review" | "done" | "failed";

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

// ─── Task Type ───

export type TaskType = 'general' | 'seo' | 'edm';

// ─── Task Log ───

export interface TaskLog {
  timestamp: string; // ISO 8601
  message: string;
}

// ─── Subtask ───

export interface Subtask {
  title: string;
  done: boolean;
}

// ─── Task ───

export interface Task {
  id: string;
  title: string;
  description: string;
  column: Column;
  progress: number; // 0–100
  tags: string[];
  subtasks: Subtask[];

  // Task type
  taskType: TaskType;

  // OpenClaw linkage
  sessionId: string | null; // which lobster session spawned this
  source: "agent" | "sync"; // agent = lobster reported; sync = extracted from history

  // Result
  result: string | null; // final output summary

  // Progress logs
  logs: TaskLog[];

  // Timestamps
  createdAt: string; // ISO
  updatedAt: string; // ISO
  startedAt: string | null;
  completedAt: string | null;
}

// ─── Board ───

export interface Board {
  version: number; // schema version for future migration
  tasks: Task[];
  lastSyncAt: string | null; // last time we synced from session history
}

// ─── Stats ───

export interface BoardStats {
  total: number;
  byColumn: Record<Column, number>;
  completedToday: number;
  completedThisWeek: number;
  avgCompletionTimeMs: number | null;
  topTags: { tag: string; count: number }[];
  activeSessionCount: number;
}

// ─── Events (for real-time UI push) ───

export type BoardEvent =
  | { type: "task_created"; task: Task }
  | { type: "task_updated"; task: Task }
  | { type: "task_moved"; taskId: string; from: Column; to: Column }
  | { type: "task_deleted"; taskId: string }
  | { type: "board_synced"; stats: BoardStats }
  | { type: "full_refresh"; board: Board };

// ─── Tool call params (match openclaw.plugin.json) ───

export interface KanbanUpdateParams {
  action: "create" | "update" | "move" | "complete" | "fail";
  taskId?: string;
  title?: string;
  description?: string;
  column?: Column;
  progress?: number;
  tags?: string[];
  sessionId?: string;
  subtasks?: Subtask[];
  result?: string;
  logMessage?: string;
  template?: string;
  taskType?: TaskType;
  campaignId?: string;
  artifacts?: Array<{ filename: string; type: string; localPath?: string; url?: string }>;
}

export interface KanbanQueryParams {
  query: "list" | "stats" | "detail" | "search";
  column?: Column | "all";
  taskId?: string;
  keyword?: string;
  limit?: number;
  taskType?: TaskType;
}

// ─── EDM Campaign ───

export interface Campaign {
  id: string;
  subject: string;
  fromAddress: string;
  htmlSnapshot: string;
  tags: string[];
  totalRecipients: number;
  createdAt: string;
  updatedAt: string;
  stats: CampaignStats;
}

export interface CampaignRecipient {
  emailId: string;
  to: string;
  lastEvent: string;
  lastEventAt: string | null;
  createdAt: string;
}

export interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface EdmQueryParams {
  query: "list" | "detail" | "stats" | "filter";
  campaignId?: string;
  filterEvent?: string;
  exclude?: boolean;
  limit?: number;
}
