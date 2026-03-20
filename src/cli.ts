#!/usr/bin/env node

/**
 * claw-kanban CLI
 *
 * Local task management (cloud mode uses kanban_update/kanban_query tools).
 * View your tasks at teammate.work
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
import { VideoCloudStore } from "./store/video-store.js";
import { SessionCollector } from "./collector/index.js";
import { getMergedConfig } from "./config.js";
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
    case "video":
      return runVideo();
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

// ─── Video ───

function getVideoStore(): VideoCloudStore {
  const config = getMergedConfig({});
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    console.error("Error: API key not configured.");
    console.error("Run: claw-kanban video --help  or configure via ~/.claw-kanban/config.json");
    process.exit(1);
  }
  const endpoint = config.cloudApiEndpoint?.trim() ?? "https://www.teammate.work/api/v1";
  return new VideoCloudStore(apiKey, endpoint);
}

async function runVideo() {
  const subcommand = args[1] ?? "help";

  switch (subcommand) {
    case "process":
      return runVideoProcess();
    case "list":
    case "ls":
      return runVideoList();
    case "detail":
    case "show":
      return runVideoDetail();
    case "download":
      return runVideoDownload();
    case "delete":
    case "rm":
      return runVideoDelete();
    case "help":
    case "--help":
    case "-h":
      return printVideoHelp();
    default:
      console.error(`Unknown video subcommand: ${subcommand}`);
      printVideoHelp();
      process.exit(1);
  }
}

async function runVideoProcess() {
  const filePath = args[2];
  if (!filePath) {
    console.error("Usage: claw-kanban video process <file> [--keywords '...'] [--output ./clips/]");
    process.exit(1);
  }

  const store = getVideoStore();
  const keywords = getFlag("keywords");

  const progress = (msg: string) => {
    if (!hasFlag("json")) console.log(`  ${msg}`);
  };

  if (!hasFlag("json")) console.log("\n🎬 Processing video...\n");

  try {
    // 1. Upload
    progress("Step 1/4: Uploading video...");
    const upload = await store.uploadVideo(filePath, progress);

    // 2. Transcribe
    progress("Step 2/4: Transcribing audio...");
    const transcription = await store.transcribe(
      upload.storagePath,
      upload.fileName,
      keywords,
      progress
    );

    // 3. Analyze
    progress("Step 3/4: AI semantic analysis...");
    const analysis = await store.analyze(
      transcription.segments,
      transcription.duration,
      transcription.projectId,
      progress
    );

    // 4. Split
    progress("Step 4/4: Splitting video into clips...");
    const splitResult = await store.split(
      transcription.videoPath,
      analysis.segments.map((s) => ({
        start: s.start,
        end: s.end,
        title: s.title,
        segmentId: s.segmentId,
      })),
      transcription.projectId,
      progress
    );

    // 5. Optional download
    const outputDir = getFlag("output");
    if (outputDir) {
      progress(`Downloading ${splitResult.segments.length} clips to ${outputDir}...`);
      for (const seg of splitResult.segments) {
        if (!seg.publicUrl) continue;
        const safeTitle = (seg.title || "clip").replace(/[^a-zA-Z0-9._-]/g, "_");
        const outputPath = `${outputDir}/${safeTitle}.mp4`;
        await store.downloadClip(seg.publicUrl, outputPath, progress);
      }
    }

    if (hasFlag("json")) {
      console.log(JSON.stringify({
        success: true,
        projectId: transcription.projectId,
        clips: splitResult.segments.map((s) => ({ title: s.title, publicUrl: s.publicUrl })),
      }));
    } else {
      console.log(`\n✅ Done! ${splitResult.segments.length} clips created.`);
      console.log(`   Project ID: ${transcription.projectId}`);
      for (const seg of splitResult.segments) {
        console.log(`   🎞️  ${seg.title}`);
        if (seg.publicUrl) console.log(`      ${seg.publicUrl}`);
      }
      console.log();
    }
  } catch (error: any) {
    if (hasFlag("json")) {
      console.log(JSON.stringify({ success: false, error: error.message }));
    } else {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
    process.exit(1);
  }
}

async function runVideoList() {
  const store = getVideoStore();

  try {
    const projects = await store.listProjects();

    if (hasFlag("json")) {
      console.log(JSON.stringify({ projects }));
      return;
    }

    if (projects.length === 0) {
      console.log("No video projects found.");
      return;
    }

    console.log("\n🎬 Video Projects\n");
    for (const p of projects) {
      const dur = p.duration ? `${Math.round(p.duration)}s` : "?";
      const date = new Date(p.created_at).toLocaleDateString();
      console.log(`  ${p.title}  (${dur})  ${date}  [${p.id}]`);
    }
    console.log(`\n${projects.length} project(s)\n`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function runVideoDetail() {
  const projectId = args[2];
  if (!projectId) {
    console.error("Usage: claw-kanban video detail <projectId>");
    process.exit(1);
  }

  const store = getVideoStore();

  try {
    const detail = await store.getProject(projectId);

    if (hasFlag("json")) {
      console.log(JSON.stringify(detail));
      return;
    }

    const p = detail.project;
    console.log(`\n🎬 ${p.title}`);
    console.log(`${"─".repeat(40)}`);
    console.log(`ID:       ${p.id}`);
    console.log(`Duration: ${Math.round(p.duration)}s`);
    console.log(`Created:  ${p.created_at}`);
    console.log(`Status:   ${p.upload_status}`);

    if (detail.segments.length > 0) {
      console.log(`\nClips (${detail.segments.length}):`);
      for (let i = 0; i < detail.segments.length; i++) {
        const s = detail.segments[i];
        const start = formatTime(s.start);
        const end = formatTime(s.end);
        console.log(`  ${i}. ${s.title}  [${start} → ${end}]`);
        if (s.summary) console.log(`     ${s.summary}`);
        if (s.publicUrl) console.log(`     ${s.publicUrl}`);
      }
    } else {
      console.log("\nNo clips generated yet.");
    }
    console.log();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function runVideoDownload() {
  const projectId = args[2];
  if (!projectId) {
    console.error("Usage: claw-kanban video download <projectId> [--output ./clips/] [--segment 0]");
    process.exit(1);
  }

  const store = getVideoStore();
  const outputDir = getFlag("output") ?? "./clips";
  const segmentIdx = getFlag("segment") !== undefined ? parseInt(getFlag("segment")!, 10) : undefined;

  try {
    const detail = await store.getProject(projectId);
    const segments = detail.segments;

    if (segments.length === 0) {
      console.error("No clips found for this project. Run 'video process' first.");
      process.exit(1);
    }

    const toDownload = segmentIdx !== undefined
      ? segments.filter((_, i) => i === segmentIdx)
      : segments;

    if (toDownload.length === 0) {
      console.error(`Segment index ${segmentIdx} not found.`);
      process.exit(1);
    }

    if (!hasFlag("json")) console.log(`\nDownloading ${toDownload.length} clip(s) to ${outputDir}...\n`);

    const downloaded: string[] = [];
    for (const seg of toDownload) {
      if (!seg.publicUrl) continue;
      const safeTitle = (seg.title || "clip").replace(/[^a-zA-Z0-9._-]/g, "_");
      const outputPath = `${outputDir}/${safeTitle}.mp4`;
      await store.downloadClip(seg.publicUrl, outputPath, (msg) => {
        if (!hasFlag("json")) console.log(`  ${msg}`);
      });
      downloaded.push(outputPath);
    }

    if (hasFlag("json")) {
      console.log(JSON.stringify({ success: true, downloaded }));
    } else {
      console.log(`\n✅ Downloaded ${downloaded.length} clip(s)\n`);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

async function runVideoDelete() {
  const projectId = args[2];
  if (!projectId) {
    console.error("Usage: claw-kanban video delete <projectId>");
    process.exit(1);
  }

  const store = getVideoStore();

  try {
    await store.deleteProject(projectId);

    if (hasFlag("json")) {
      console.log(JSON.stringify({ success: true }));
    } else {
      console.log(`✅ Deleted project ${projectId}`);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function printVideoHelp() {
  console.log(`
🎬 claw-kanban video — Video Clip Processing

Commands:
  process <file> [options]           Process video: upload → transcribe → analyze → split
  list                               List all video projects
  detail <projectId>                 Show project detail with clips
  download <projectId> [options]     Download clips to local disk
  delete <projectId>                 Delete a video project

Options for process:
  --keywords <text>                  Keywords to improve transcription accuracy
  --output <dir>                     Auto-download clips after processing

Options for download:
  --output <dir>                     Output directory (default: ./clips)
  --segment <index>                  Download only a specific segment (0-based)

Global:
  --json                             Output JSON (for machine parsing)
`);
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
  video <subcommand>                 Video clip processing (run 'video help' for details)

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
