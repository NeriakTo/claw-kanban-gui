#!/usr/bin/env node

/**
 * claw-kanban CLI
 *
 * Local task management (cloud mode uses kanban_update/kanban_query tools).
 * View your tasks at webkanbanforopenclaw.vercel.app
 *
 * Usage:
 *   claw-kanban add <title> [options]   Create a task
 *   claw-kanban update <id> [options]   Update a task
 *   claw-kanban done <id> [--result ..]  Complete a task
 *   claw-kanban fail <id> [--result ..]  Mark a task as failed
 *   claw-kanban list [column]           List tasks
 *   claw-kanban stats                   Print board statistics
 *   claw-kanban detail <id>             Show task detail
 *   claw-kanban sync                    Sync from OpenClaw session history
 */

import { BoardStore, BoardStorage } from "./store/index.js";
import { SessionCollector } from "./collector/index.js";
import type { Column, Subtask } from "./types.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

// ─── Arg parsing helpers ───

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function getFlagAll(name: string): string[] {
  const results: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1]) {
      results.push(args[i + 1]);
    }
  }
  return results;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// Collect everything after "--result" as one string
function getResultText(): string | undefined {
  const idx = args.indexOf("--result");
  if (idx < 0) return undefined;
  return args.slice(idx + 1).join(" ") || undefined;
}

async function main() {
  const store = new BoardStore();
  const storage = new BoardStorage(store);
  await storage.load();

  switch (command) {
    case "add":
    case "create":
      return runAdd(store, storage);
    case "update":
      return runUpdate(store, storage);
    case "done":
    case "complete":
      return runDone(store, storage);
    case "fail":
      return runFail(store, storage);
    case "list":
    case "ls":
      return runList(store);
    case "stats":
      return runStats(store);
    case "detail":
    case "show":
      return runDetail(store);
    case "sync":
      return runSync(store, storage);
    case "help":
    case "--help":
    case "-h":
      return printHelp();
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

// ─── Add ───

async function runAdd(store: BoardStore, storage: BoardStorage) {
  const title = args[1];
  if (!title) {
    console.error("Usage: claw-kanban add <title> [--desc ...] [--tags code,email] [--col in_progress] [--subtasks 'step1,step2']");
    process.exit(1);
  }

  const desc = getFlag("desc") ?? getFlag("description") ?? "";
  const col = (getFlag("col") ?? getFlag("column") ?? "in_progress") as Column;
  const tagsRaw = getFlag("tags") ?? "";
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : [];
  const subtasksRaw = getFlag("subtasks") ?? "";
  const subtasks: Subtask[] = subtasksRaw
    ? subtasksRaw.split(",").map((s) => ({ title: s.trim(), done: false }))
    : [];
  const progress = getFlag("progress") ? parseInt(getFlag("progress")!, 10) : 0;
  const sessionId = getFlag("session") ?? null;

  const task = store.handleUpdate({
    action: "create",
    title,
    description: desc,
    column: col,
    tags,
    subtasks,
    progress,
    sessionId: sessionId ?? undefined,
  });

  await storage.save();

  // Output JSON for lobster to parse, human-friendly for terminal
  if (hasFlag("json")) {
    console.log(JSON.stringify({ success: true, task }));
  } else {
    console.log(`✅ Created: ${task.title} (${task.id})`);
    console.log(`   Column: ${task.column} | Tags: ${task.tags.join(", ") || "—"}`);
  }
}

// ─── Update ───

async function runUpdate(store: BoardStore, storage: BoardStorage) {
  const taskId = args[1];
  if (!taskId) {
    console.error("Usage: claw-kanban update <id> [--title ...] [--progress N] [--tags ...] [--col ...] [--subtasks ...]");
    process.exit(1);
  }

  const params: Record<string, unknown> = { action: "update", taskId };
  const title = getFlag("title");
  if (title) params.title = title;
  const desc = getFlag("desc") ?? getFlag("description");
  if (desc) params.description = desc;
  const progress = getFlag("progress");
  if (progress) params.progress = parseInt(progress, 10);
  const col = getFlag("col") ?? getFlag("column");
  if (col) params.column = col;
  const tagsRaw = getFlag("tags");
  if (tagsRaw) params.tags = tagsRaw.split(",").map((t) => t.trim());
  const subtasksRaw = getFlag("subtasks");
  if (subtasksRaw) {
    params.subtasks = subtasksRaw.split(",").map((s) => {
      const done = s.trim().startsWith("[x]") || s.trim().startsWith("[X]");
      const title = s.trim().replace(/^\[[ xX]\]\s*/, "");
      return { title, done };
    });
  }

  const task = store.handleUpdate(params as any);
  await storage.save();

  if (hasFlag("json")) {
    console.log(JSON.stringify({ success: true, task }));
  } else {
    console.log(`✅ Updated: ${task.title} (${task.id}) → ${task.column} ${task.progress}%`);
  }
}

// ─── Done ───

async function runDone(store: BoardStore, storage: BoardStorage) {
  const taskId = args[1];
  if (!taskId) {
    console.error("Usage: claw-kanban done <id> [--result summary text]");
    process.exit(1);
  }

  const result = getResultText();
  const task = store.handleUpdate({ action: "complete", taskId, result });
  await storage.save();

  if (hasFlag("json")) {
    console.log(JSON.stringify({ success: true, task }));
  } else {
    console.log(`✅ Completed: ${task.title} (${task.id})`);
    if (task.result) console.log(`   Result: ${task.result}`);
  }
}

// ─── Fail ───

async function runFail(store: BoardStore, storage: BoardStorage) {
  const taskId = args[1];
  if (!taskId) {
    console.error("Usage: claw-kanban fail <id> [--result error description]");
    process.exit(1);
  }

  const result = getResultText();
  const task = store.handleUpdate({ action: "fail", taskId, result });
  await storage.save();

  if (hasFlag("json")) {
    console.log(JSON.stringify({ success: true, task }));
  } else {
    console.log(`❌ Failed: ${task.title} (${task.id})`);
    if (task.result) console.log(`   Reason: ${task.result}`);
  }
}

// ─── List ───

async function runList(store: BoardStore) {
  const column = args[1] as Column | undefined;
  const tasks = store
    .getBoard()
    .tasks.filter((t) => !column || t.column === column)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  if (hasFlag("json")) {
    console.log(JSON.stringify({ tasks, total: tasks.length }));
    return;
  }

  if (tasks.length === 0) {
    console.log(column ? `No tasks in ${column}` : "Board is empty");
    return;
  }

  const colSymbols: Record<string, string> = {
    backlog: "⬜",
    in_progress: "🔵",
    review: "🟡",
    done: "✅",
    failed: "❌",
  };

  for (const t of tasks) {
    const sym = colSymbols[t.column] ?? "·";
    const pct = t.progress > 0 && t.progress < 100 ? ` ${t.progress}%` : "";
    const tags = t.tags.length ? ` [${t.tags.join(", ")}]` : "";
    console.log(`${sym} ${t.title}${pct}${tags}  (${t.id})`);
  }
  console.log(`\n${tasks.length} task(s)`);
}

// ─── Detail ───

async function runDetail(store: BoardStore) {
  const taskId = args[1];
  if (!taskId) {
    console.error("Usage: claw-kanban detail <id>");
    process.exit(1);
  }

  const task = store.getBoard().tasks.find((t) => t.id === taskId);
  if (!task) {
    console.error(`Task not found: ${taskId}`);
    process.exit(1);
  }

  if (hasFlag("json")) {
    console.log(JSON.stringify(task));
    return;
  }

  const colSymbols: Record<string, string> = {
    backlog: "⬜ Backlog",
    in_progress: "🔵 In Progress",
    review: "🟡 Review",
    done: "✅ Done",
    failed: "❌ Failed",
  };

  console.log(`\n${task.title}`);
  console.log(`${"─".repeat(40)}`);
  console.log(`ID:       ${task.id}`);
  console.log(`Status:   ${colSymbols[task.column] ?? task.column}`);
  console.log(`Progress: ${task.progress}%`);
  console.log(`Tags:     ${task.tags.join(", ") || "—"}`);
  console.log(`Source:   ${task.source === "agent" ? "🦞 Agent" : "🔄 Sync"}`);
  console.log(`Session:  ${task.sessionId ?? "—"}`);
  if (task.description) console.log(`\nDescription:\n  ${task.description}`);
  if (task.subtasks.length) {
    console.log(`\nSubtasks:`);
    for (const s of task.subtasks) {
      console.log(`  ${s.done ? "✅" : "⬜"} ${s.title}`);
    }
  }
  if (task.result) console.log(`\nResult:\n  ${task.result}`);
  console.log(`\nCreated:   ${task.createdAt}`);
  if (task.startedAt) console.log(`Started:   ${task.startedAt}`);
  if (task.completedAt) console.log(`Completed: ${task.completedAt}`);
  console.log();
}

// ─── Stats ───

async function runStats(store: BoardStore) {
  const s = store.getStats();

  if (hasFlag("json")) {
    console.log(JSON.stringify(s));
    return;
  }

  console.log("📋 Claw Kanban Stats\n");
  console.log(`  Total:        ${s.total}`);
  console.log(`  Backlog:      ${s.byColumn.backlog}`);
  console.log(`  In Progress:  ${s.byColumn.in_progress}`);
  console.log(`  Review:       ${s.byColumn.review}`);
  console.log(`  Done:         ${s.byColumn.done}`);
  console.log(`  Failed:       ${s.byColumn.failed}`);
  console.log();
  console.log(`  Done today:      ${s.completedToday}`);
  console.log(`  Done this week:  ${s.completedThisWeek}`);
  if (s.avgCompletionTimeMs) {
    const mins = Math.round(s.avgCompletionTimeMs / 60000);
    console.log(`  Avg completion:  ${mins} min`);
  }
  if (s.topTags.length) {
    console.log(
      `  Top tags:        ${s.topTags.map((t) => `${t.tag}(${t.count})`).join(", ")}`
    );
  }
  console.log();
}

// ─── Sync ───

async function runSync(store: BoardStore, storage: BoardStorage) {
  console.log("[claw-kanban] Syncing from OpenClaw session history...\n");

  const { execSync } = await import("node:child_process");

  let sessionsRaw: string;
  try {
    sessionsRaw = execSync("openclaw sessions list --json", {
      encoding: "utf-8",
      timeout: 15000,
    });
  } catch {
    console.error(
      "Error: Could not fetch sessions. Is OpenClaw running?\n" +
        "  Make sure the gateway is active: openclaw gateway\n"
    );
    process.exit(1);
  }

  let sessions: any[];
  try {
    sessions = JSON.parse(sessionsRaw);
  } catch {
    sessions = sessionsRaw
      .trim()
      .split("\n")
      .filter((l) => l.startsWith("{"))
      .map((l) => JSON.parse(l));
  }

  console.log(`  Found ${sessions.length} sessions`);

  const collector = new SessionCollector(store);
  const historyMap = new Map<string, any[]>();

  const recentSessions = sessions.slice(0, 20);
  for (const session of recentSessions) {
    try {
      const histRaw = execSync(
        `openclaw sessions history ${session.id} --json`,
        { encoding: "utf-8", timeout: 10000 }
      );
      const messages = JSON.parse(histRaw);
      historyMap.set(session.id, messages);
    } catch {
      // Skip sessions we can't fetch
    }
  }

  const result = collector.syncFromSessions(recentSessions, historyMap);
  await storage.save();

  console.log(
    `\n  Sync complete: ${result.created} new, ${result.updated} updated`
  );
  console.log(`  Board: ${store.getStats().total} total tasks\n`);
}

// ─── Help ───

function printHelp() {
  console.log(`
🦞 claw-kanban — OpenClaw Kanban Task Board

Commands:
  add <title> [options]              Create a new task
  update <id> [options]              Update a task
  done <id> [--result ...]           Complete a task
  fail <id> [--result ...]           Mark a task as failed
  list [column]                      List tasks
  detail <id>                        Show task detail
  stats                              Print board statistics
  sync                               Sync from OpenClaw session history

Options for add/update:
  --desc <text>                      Description
  --tags <a,b,c>                     Comma-separated tags
  --col <column>                     Column (backlog|in_progress|review|done|failed)
  --progress <0-100>                 Progress percentage
  --subtasks <a,b,c>                 Comma-separated subtask titles
  --session <id>                     Link to OpenClaw session
  --json                             Output JSON (for machine parsing)

Data stored in: ~/.openclaw/data/kanban/
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
