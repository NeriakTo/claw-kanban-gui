import type { Task } from "../types.js";
import { BoardStore } from "../store/board-store.js";

/**
 * Describes a raw session from OpenClaw's sessions_list tool.
 */
export interface RawSession {
  id: string;
  status?: string;
  model?: string;
  channel?: string;
  createdAt?: string;
  updatedAt?: string;
  messageCount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Describes a message from OpenClaw's sessions_history tool.
 */
export interface RawMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  toolCalls?: RawToolCall[];
  timestamp?: string;
}

export interface RawToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status?: string;
}

/**
 * Patterns we look for in session history to infer tasks.
 */
const TASK_SIGNALS = [
  // Direct task-related tool calls
  "exec",
  "browser",
  "apply_patch",
  "write_file",
  "read_file",
  "search",
  // Common action verbs in assistant messages
] as const;

/**
 * SessionCollector parses OpenClaw session data into structured tasks.
 *
 * Two modes:
 * 1. From raw session list + history (bulk sync)
 * 2. From individual session events (incremental)
 */
export class SessionCollector {
  constructor(private store: BoardStore) {}

  /**
   * Process a batch of sessions and their histories.
   * Typically called on sync trigger.
   */
  syncFromSessions(
    sessions: RawSession[],
    historyMap: Map<string, RawMessage[]>
  ): { created: number; updated: number } {
    let created = 0;
    let updated = 0;

    for (const session of sessions) {
      const messages = historyMap.get(session.id) ?? [];
      const tasks = this.extractTasks(session, messages);

      for (const task of tasks) {
        const existing = this.store
          .getBoard()
          .tasks.find(
            (t) => t.sessionId === session.id && t.source === "sync" && t.id === task.id
          );
        if (existing) {
          // Update if the session has new info
          this.store.upsertTask({ ...existing, ...task, updatedAt: new Date().toISOString() });
          updated++;
        } else {
          this.store.upsertTask(task);
          created++;
        }
      }
    }

    this.store.markSynced();
    return { created, updated };
  }

  /**
   * Extract structured tasks from a single session's history.
   */
  extractTasks(session: RawSession, messages: RawMessage[]): Task[] {
    const tasks: Task[] = [];

    // Strategy 1: Look for user requests → assistant actions pattern
    const userRequests = this.extractUserRequests(messages);

    for (const req of userRequests) {
      const taskId = `sync-${session.id.slice(0, 4)}-${req.index}`;
      const toolsUsed = this.findToolCallsAfter(messages, req.index);
      const completion = this.detectCompletion(messages, req.index);

      const tags = this.inferTags(req.content, toolsUsed);

      const task: Task = {
        id: taskId,
        title: this.summarizeRequest(req.content),
        description: req.content.slice(0, 500),
        column: completion.completed
          ? completion.failed
            ? "failed"
            : "done"
          : session.status === "busy"
            ? "in_progress"
            : "backlog",
        progress: completion.completed ? 100 : completion.progress,
        tags,
        subtasks: toolsUsed.map((tc) => ({
          title: `${tc.name}${tc.args?.command ? `: ${String(tc.args.command).slice(0, 60)}` : ""}`,
          done: tc.status === "success" || tc.status === "completed",
        })),
        taskType: "general",
        sessionId: session.id,
        source: "sync",
        result: completion.result,
        logs: [],
        createdAt: req.timestamp ?? session.createdAt ?? new Date().toISOString(),
        updatedAt: session.updatedAt ?? new Date().toISOString(),
        startedAt: req.timestamp ?? null,
        completedAt: completion.completed
          ? completion.timestamp ?? null
          : null,
      };
      tasks.push(task);
    }

    // Strategy 2: If no clear user requests, create one task per session
    if (tasks.length === 0 && messages.length > 0) {
      const firstUser = messages.find((m) => m.role === "user" && m.content);
      if (firstUser) {
        tasks.push({
          id: `sync-${session.id.slice(0, 8)}`,
          title: this.summarizeRequest(firstUser.content ?? "Session task"),
          description: firstUser.content?.slice(0, 500) ?? "",
          column: session.status === "busy" ? "in_progress" : "done",
          progress: session.status === "busy" ? 50 : 100,
          tags: this.inferTags(firstUser.content ?? "", []),
          subtasks: [],
          taskType: "general",
          sessionId: session.id,
          source: "sync",
          result: null,
          logs: [],
          createdAt: session.createdAt ?? new Date().toISOString(),
          updatedAt: session.updatedAt ?? new Date().toISOString(),
          startedAt: session.createdAt ?? null,
          completedAt: session.status !== "busy" ? session.updatedAt ?? null : null,
        });
      }
    }

    return tasks;
  }

  // ─── Helpers ───

  private extractUserRequests(
    messages: RawMessage[]
  ): { content: string; index: number; timestamp?: string }[] {
    return messages
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.role === "user" && m.content && m.content.length > 5)
      .map(({ m, i }) => ({
        content: m.content!,
        index: i,
        timestamp: m.timestamp,
      }));
  }

  private findToolCallsAfter(
    messages: RawMessage[],
    afterIndex: number
  ): RawToolCall[] {
    const calls: RawToolCall[] = [];
    // Look at assistant messages after this user message until next user message
    for (let i = afterIndex + 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "user") break;
      if (m.toolCalls) {
        calls.push(...m.toolCalls);
      }
    }
    return calls;
  }

  private detectCompletion(
    messages: RawMessage[],
    afterIndex: number
  ): {
    completed: boolean;
    failed: boolean;
    progress: number;
    result: string | null;
    timestamp?: string;
  } {
    let lastAssistant: RawMessage | null = null;
    let hasError = false;
    let toolCount = 0;
    let successCount = 0;

    for (let i = afterIndex + 1; i < messages.length; i++) {
      const m = messages[i];
      if (m.role === "user") break;
      if (m.role === "assistant") {
        lastAssistant = m;
        if (m.content?.toLowerCase().includes("error")) hasError = true;
      }
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          toolCount++;
          if (tc.status === "success" || tc.status === "completed") successCount++;
          if (tc.status === "error") hasError = true;
        }
      }
    }

    // If there's a next user message, this request cycle is "done"
    const nextUserIdx = messages.findIndex(
      (m, i) => i > afterIndex && m.role === "user"
    );
    const completed = nextUserIdx > afterIndex || afterIndex === messages.length - 1;

    return {
      completed,
      failed: hasError && completed,
      progress: toolCount > 0 ? Math.round((successCount / toolCount) * 100) : 0,
      result: lastAssistant?.content?.slice(0, 300) ?? null,
      timestamp: lastAssistant?.timestamp,
    };
  }

  private summarizeRequest(content: string): string {
    // Take the first line, truncate to 80 chars
    const firstLine = content.split("\n")[0].trim();
    if (firstLine.length <= 80) return firstLine;
    return firstLine.slice(0, 77) + "...";
  }

  private inferTags(content: string, toolCalls: RawToolCall[]): string[] {
    const tags = new Set<string>();
    const lc = content.toLowerCase();

    // Content-based
    if (lc.includes("email") || lc.includes("gmail") || lc.includes("inbox"))
      tags.add("email");
    if (lc.includes("code") || lc.includes("bug") || lc.includes("fix"))
      tags.add("code");
    if (lc.includes("calendar") || lc.includes("schedule") || lc.includes("meeting"))
      tags.add("calendar");
    if (lc.includes("search") || lc.includes("find") || lc.includes("research"))
      tags.add("research");
    if (lc.includes("write") || lc.includes("draft") || lc.includes("blog"))
      tags.add("writing");
    if (lc.includes("file") || lc.includes("download") || lc.includes("upload"))
      tags.add("files");
    if (lc.includes("deploy") || lc.includes("server") || lc.includes("build"))
      tags.add("devops");

    // Tool-based
    for (const tc of toolCalls) {
      if (tc.name === "exec") tags.add("terminal");
      if (tc.name === "browser" || tc.name === "web") tags.add("browser");
      if (tc.name === "apply_patch" || tc.name === "write_file") tags.add("code");
    }

    return [...tags];
  }
}
