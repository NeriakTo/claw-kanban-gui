import { randomUUID } from "node:crypto";
import type {
  Board,
  BoardStats,
  Column,
  COLUMNS,
  KanbanUpdateParams,
  KanbanQueryParams,
  Task,
  BoardEvent,
} from "../types.js";

/**
 * Generate a short 8-char task ID.
 */
function shortId(): string {
  return randomUUID().slice(0, 8);
}

function now(): string {
  return new Date().toISOString();
}

/**
 * In-memory board store. Persisted to disk via BoardStorage.
 */
export class BoardStore {
  private board: Board;
  private listeners: Set<(event: BoardEvent) => void> = new Set();

  constructor(board?: Board) {
    this.board = board ?? { version: 1, tasks: [], lastSyncAt: null };
  }

  // ─── Event subscription ───

  subscribe(fn: (event: BoardEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: BoardEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        // swallow listener errors
      }
    }
  }

  // ─── Snapshot ───

  getBoard(): Board {
    return this.board;
  }

  setBoard(board: Board): void {
    this.board = board;
    this.emit({ type: "full_refresh", board });
  }

  // ─── CRUD via tool params ───

  handleUpdate(params: KanbanUpdateParams): Task {
    switch (params.action) {
      case "create":
        return this.createTask(params);
      case "update":
        return this.updateTask(params);
      case "move":
        return this.moveTask(params);
      case "complete":
        return this.completeTask(params);
      case "fail":
        return this.failTask(params);
      case "delete":
        return this.deleteTask(params);
      case "archive":
        return this.archiveTask(params);
    }
  }

  private createTask(params: KanbanUpdateParams): Task {
    const task: Task = {
      id: params.taskId ?? shortId(),
      title: params.title ?? "Untitled task",
      description: params.description ?? "",
      column: params.column ?? "backlog",
      progress: params.progress ?? 0,
      tags: params.tags ?? [],
      subtasks: params.subtasks ?? [],
      taskType: params.taskType ?? "general",
      sessionId: params.sessionId ?? null,
      source: "agent",
      dependsOn: params.dependsOn ?? [],
      archived: false,
      result: null,
      logs: [],
      createdAt: now(),
      updatedAt: now(),
      startedAt: params.column === "in_progress" ? now() : null,
      completedAt: null,
    };
    this.board.tasks.push(task);
    this.emit({ type: "task_created", task });
    return task;
  }

  private updateTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    if (params.title !== undefined) task.title = params.title;
    if (params.description !== undefined) task.description = params.description;
    if (params.progress !== undefined) task.progress = params.progress;
    if (params.tags !== undefined) task.tags = params.tags;
    // Optional explicit subtasks provided
    if (params.subtasks && params.subtasks.length > 0) {
      if (!task.subtasks) task.subtasks = [];
      for (const updateSub of params.subtasks) {
        const existing = task.subtasks.find(s => s.title === updateSub.title);
        if (existing) {
          existing.done = updateSub.done;
        } else {
          task.subtasks.push(updateSub);
        }
      }
    }
    if (params.dependsOn !== undefined) {
      if (this.hasCycle(task.id, params.dependsOn)) {
        throw new Error("Circular dependency detected");
      }
      task.dependsOn = params.dependsOn;
    }
    if (params.logMessage) {
      if (!task.logs) task.logs = [];
      task.logs.push({ timestamp: now(), message: params.logMessage });
    }
    if (params.column !== undefined) {
      const from = task.column;
      task.column = params.column;
      if (params.column === "in_progress" && !task.startedAt) {
        task.startedAt = now();
      }
    }
    task.updatedAt = now();
    this.emit({ type: "task_updated", task });
    return task;
  }

  private moveTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    const from = task.column;
    const to = params.column ?? task.column;
    task.column = to;
    if (to === "in_progress" && !task.startedAt) {
      task.startedAt = now();
    }
    if (to === "done") {
      task.completedAt = now();
      task.progress = 100;
    }
    task.updatedAt = now();
    this.emit({ type: "task_moved", taskId: task.id, from, to });
    return task;
  }

  private completeTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    const from = task.column;
    task.column = "done";
    task.progress = 100;
    task.completedAt = now();
    if (params.result !== undefined) task.result = params.result;
    task.updatedAt = now();
    this.emit({ type: "task_moved", taskId: task.id, from, to: "done" });
    return task;
  }

  private failTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    const from = task.column;
    task.column = "failed";
    if (params.result !== undefined) task.result = params.result;
    task.updatedAt = now();
    this.emit({ type: "task_moved", taskId: task.id, from, to: "failed" });
    return task;
  }

  private deleteTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    this.board.tasks = this.board.tasks.filter((t) => t.id !== task.id);
    this.emit({ type: "task_deleted", taskId: task.id });
    return task;
  }

  private archiveTask(params: KanbanUpdateParams): Task {
    const task = this.findTask(params.taskId);
    task.archived = true;
    task.updatedAt = now();
    this.emit({ type: "task_updated", task });
    return task;
  }

  getDependencyStatus(taskId: string): { blocked: boolean; blockedBy: string[] } {
    const task = this.findTask(taskId);
    const blockedBy = (task.dependsOn ?? []).filter((depId) => {
      const dep = this.board.tasks.find((t) => t.id === depId);
      return dep && dep.column !== "done";
    });
    return { blocked: blockedBy.length > 0, blockedBy };
  }

  // ─── Query ───

  handleQuery(params: KanbanQueryParams): unknown {
    switch (params.query) {
      case "list":
        return this.listTasks(params.column, params.limit);
      case "stats":
        return this.getStats();
      case "detail":
        return this.findTask(params.taskId);
      case "search":
        return this.searchTasks(params.keyword ?? "", params.limit);
    }
  }

  private listTasks(column?: Column | "all", limit = 20): Task[] {
    let tasks = this.board.tasks.filter((t) => !t.archived);
    if (column && column !== "all") {
      tasks = tasks.filter((t) => t.column === column);
    }
    // Sort: in_progress first, then by updatedAt desc
    tasks = [...tasks].sort((a, b) => {
      const colOrder: Record<Column, number> = {
        in_progress: 0,
        backlog: 1,
        review: 2,
        done: 3,
        failed: 4,
      };
      const diff = colOrder[a.column] - colOrder[b.column];
      if (diff !== 0) return diff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return tasks.slice(0, limit);
  }

  getStats(): BoardStats {
    const tasks = this.board.tasks;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const byColumn: Record<Column, number> = {
      backlog: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      failed: 0,
    };
    const tagCounts = new Map<string, number>();
    const sessionIds = new Set<string>();
    let completedToday = 0;
    let completedThisWeek = 0;
    const completionTimes: number[] = [];

    for (const t of tasks) {
      byColumn[t.column]++;
      for (const tag of t.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
      if (t.sessionId) sessionIds.add(t.sessionId);
      if (t.completedAt) {
        const ct = new Date(t.completedAt).getTime();
        if (ct >= todayStart.getTime()) completedToday++;
        if (ct >= weekStart.getTime()) completedThisWeek++;
        if (t.startedAt) {
          completionTimes.push(ct - new Date(t.startedAt).getTime());
        }
      }
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const avgCompletionTimeMs =
      completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : null;

    return {
      total: tasks.length,
      byColumn,
      completedToday,
      completedThisWeek,
      avgCompletionTimeMs,
      topTags,
      activeSessionCount: sessionIds.size,
    };
  }

  private searchTasks(keyword: string, limit = 20): Task[] {
    const kw = keyword.toLowerCase();
    return this.board.tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(kw) ||
          t.description.toLowerCase().includes(kw) ||
          t.tags.some((tag) => tag.toLowerCase().includes(kw))
      )
      .slice(0, limit);
  }

  // ─── Bulk import (for sync) ───

  upsertTask(task: Task): void {
    const idx = this.board.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      this.board.tasks[idx] = task;
      this.emit({ type: "task_updated", task });
    } else {
      this.board.tasks.push(task);
      this.emit({ type: "task_created", task });
    }
  }

  markSynced(): void {
    this.board.lastSyncAt = now();
  }

  // ─── Helpers ───

  private findTask(taskId?: string): Task {
    if (!taskId) throw new Error("taskId is required");
    const task = this.board.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return task;
  }

  /**
   * Detect circular dependency via BFS traversal.
   */
  private hasCycle(startId: string, dependsOn: string[]): boolean {
    const visited = new Set<string>();
    const queue = [...dependsOn];
    while (queue.length) {
      const id = queue.shift()!;
      if (id === startId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      const dep = this.board.tasks.find((t) => t.id === id);
      if (dep?.dependsOn) queue.push(...dep.dependsOn);
    }
    return false;
  }
}
