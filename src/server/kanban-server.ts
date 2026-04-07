import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { BoardEvent, Column, COLUMNS } from "../types.js";
import { BoardStore } from "../store/board-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UI_DIR = resolve(join(__dirname, "..", "ui"));

const VALID_COLUMNS: ReadonlySet<string> = new Set([
  "backlog", "in_progress", "review", "done", "failed",
]);

/**
 * Lightweight HTTP + WebSocket server for the Kanban UI.
 *
 * Read endpoints:
 * - GET  /           → serves the Kanban board HTML
 * - GET  /api/board  → returns full board JSON
 * - GET  /api/stats  → returns board stats JSON
 *
 * Write endpoints:
 * - POST /api/tasks              → create task
 * - PUT  /api/tasks/:id          → update task
 * - PUT  /api/tasks/:id/move     → move task to column
 * - PUT  /api/tasks/:id/complete → mark task done
 * - PUT  /api/tasks/:id/fail     → mark task failed
 *
 * Real-time:
 * - WS   /ws → board events (task_created, task_updated, task_moved, etc.)
 */
export class KanbanServer {
  private wss: WebSocketServer | null = null;
  private httpServer: ReturnType<typeof createServer> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(private store: BoardStore) {}

  async start(port = 18790): Promise<void> {
    console.log(`[claw-kanban] Attempting to serve UI from: ${UI_DIR}`);
    this.httpServer = createServer(async (req, res) => {
      await this.handleHttp(req, res);
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws) => {
      // Send full board on connect
      ws.send(
        JSON.stringify({
          type: "full_refresh",
          board: this.store.getBoard(),
        })
      );
    });

    // Broadcast board events to all connected WebSocket clients
    this.unsubscribe = this.store.subscribe((event) => {
      this.broadcast(event);
    });

    return new Promise<void>((resolve) => {
      this.httpServer!.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.log(`[claw-kanban] Port ${port} already in use — UI server already running, skipping.`);
          this.httpServer = null;
          this.wss = null;
          resolve();
        }
      });
      this.httpServer!.listen(port, () => {
        console.log(`[claw-kanban] Board UI: http://localhost:${port}`);
        console.log(`[claw-kanban] WebSocket: ws://localhost:${port}/ws`);
        resolve();
      });
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.wss?.close();
    this.httpServer?.close();
  }

  private broadcast(event: BoardEvent): void {
    if (!this.wss) return;
    const msg = JSON.stringify(event);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  /**
   * Parse JSON body from incoming request.
   */
  private parseBody(req: IncomingMessage, maxBytes = 1_048_576): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      req.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy();
          reject(new KanbanValidationError("Request body too large"));
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf-8");
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          reject(new Error("Invalid JSON body"));
        }
      });
      req.on("error", reject);
    });
  }

  /**
   * Send JSON response with status code.
   */
  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  /**
   * Extract task ID from URL pattern /api/tasks/:id or /api/tasks/:id/action.
   */
  private extractTaskId(url: string): string | null {
    const match = url.match(/^\/api\/tasks\/([a-f0-9]+)/);
    return match ? match[1] : null;
  }

  /**
   * Validate column value is one of the 5 valid columns.
   */
  private validateColumn(value: unknown): Column {
    if (typeof value !== "string" || !VALID_COLUMNS.has(value)) {
      throw new KanbanValidationError(`Invalid column: ${String(value)}`);
    }
    return value as Column;
  }

  /**
   * Validate and clamp progress to 0-100.
   */
  private validateProgress(value: unknown): number | undefined {
    if (value === undefined || value === null) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new KanbanValidationError("progress must be a number");
    }
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  /**
   * Validate tags array.
   */
  private validateTags(value: unknown): string[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) {
      throw new KanbanValidationError("tags must be an array");
    }
    return value.filter((t): t is string => typeof t === "string").slice(0, 50);
  }

  /**
   * Validate dependsOn array (task IDs, max 50, hex format, no cycles checked here).
   */
  private validateDependsOn(value: unknown): string[] | undefined {
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value)) {
      throw new KanbanValidationError("dependsOn must be an array");
    }
    if (value.length > 50) {
      throw new KanbanValidationError("dependsOn exceeds maximum of 50 entries");
    }
    const ids = value.filter((v): v is string => typeof v === "string");
    if (ids.some((id) => !/^[a-f0-9]{8,36}$/.test(id))) {
      throw new KanbanValidationError("dependsOn contains invalid task ID format");
    }
    return ids;
  }

  /**
   * Validate string field with max length.
   */
  private validateString(value: unknown, maxLen = 1000): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "string") {
      throw new KanbanValidationError("Expected a string value");
    }
    return value.slice(0, maxLen);
  }

  private async handleHttp(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // CORS: allow same-origin for writes, wildcard only for reads
    const origin = req.headers.origin ?? "";
    const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    res.setHeader("Access-Control-Allow-Origin", isLocalOrigin ? origin : "http://localhost:18790");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // ─── Read API ───

    if (method === "GET" && url === "/api/board") {
      this.sendJson(res, 200, this.store.getBoard());
      return;
    }

    if (method === "GET" && url === "/api/stats") {
      this.sendJson(res, 200, this.store.getStats());
      return;
    }

    // GET /api/tasks/:id/deps
    if (method === "GET" && /^\/api\/tasks\/[a-f0-9]+\/deps$/.test(url)) {
      const taskId = this.extractTaskId(url)!;
      try {
        this.sendJson(res, 200, this.store.getDependencyStatus(taskId));
      } catch (err: unknown) {
        const isNotFound = err instanceof Error && err.message.startsWith("Task not found");
        this.sendJson(res, isNotFound ? 404 : 500, {
          error: isNotFound ? err.message : "Internal server error",
        });
      }
      return;
    }

    // ─── Write API ───

    try {
      // DELETE /api/tasks/:id
      if (method === "DELETE" && /^\/api\/tasks\/[a-f0-9]+$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const task = this.store.handleUpdate({ action: "delete", taskId });
        this.sendJson(res, 200, task);
        return;
      }

      // PUT /api/tasks/:id/archive
      if (method === "PUT" && /^\/api\/tasks\/[a-f0-9]+\/archive$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const task = this.store.handleUpdate({ action: "archive", taskId });
        this.sendJson(res, 200, task);
        return;
      }

      // POST /api/tasks → create task
      if (method === "POST" && url === "/api/tasks") {
        const body = await this.parseBody(req);
        const title = this.validateString(body.title, 500);
        if (!title) {
          this.sendJson(res, 400, { error: "title is required" });
          return;
        }
        const task = this.store.handleUpdate({
          action: "create",
          title,
          description: this.validateString(body.description, 5000),
          column: body.column !== undefined ? this.validateColumn(body.column) : undefined,
          tags: this.validateTags(body.tags),
          subtasks: body.subtasks as Array<{ title: string; done: boolean }> | undefined,
          progress: this.validateProgress(body.progress),
          dependsOn: this.validateDependsOn(body.dependsOn),
        });
        this.sendJson(res, 201, task);
        return;
      }

      // PUT /api/tasks/:id/complete
      if (method === "PUT" && /^\/api\/tasks\/[a-f0-9]+\/complete$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const body = await this.parseBody(req);
        const task = this.store.handleUpdate({
          action: "complete",
          taskId,
          result: this.validateString(body.result, 5000),
        });
        this.sendJson(res, 200, task);
        return;
      }

      // PUT /api/tasks/:id/fail
      if (method === "PUT" && /^\/api\/tasks\/[a-f0-9]+\/fail$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const body = await this.parseBody(req);
        const task = this.store.handleUpdate({
          action: "fail",
          taskId,
          result: this.validateString(body.result, 5000),
        });
        this.sendJson(res, 200, task);
        return;
      }

      // PUT /api/tasks/:id/move
      if (method === "PUT" && /^\/api\/tasks\/[a-f0-9]+\/move$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const body = await this.parseBody(req);
        const column = this.validateColumn(body.column);
        const task = this.store.handleUpdate({
          action: "move",
          taskId,
          column,
        });
        this.sendJson(res, 200, task);
        return;
      }

      // PUT /api/tasks/:id → update task
      if (method === "PUT" && /^\/api\/tasks\/[a-f0-9]+$/.test(url)) {
        const taskId = this.extractTaskId(url)!;
        const body = await this.parseBody(req);
        const task = this.store.handleUpdate({
          action: "update",
          taskId,
          title: this.validateString(body.title, 500),
          description: this.validateString(body.description, 5000),
          progress: this.validateProgress(body.progress),
          tags: this.validateTags(body.tags),
          subtasks: body.subtasks as Array<{ title: string; done: boolean }> | undefined,
          column: body.column !== undefined ? this.validateColumn(body.column) : undefined,
          logMessage: this.validateString(body.logMessage, 2000),
          dependsOn: this.validateDependsOn(body.dependsOn),
        });
        this.sendJson(res, 200, task);
        return;
      }
    } catch (err: unknown) {
      if (err instanceof KanbanValidationError) {
        this.sendJson(res, 400, { error: err.message });
        return;
      }
      const isNotFound = err instanceof Error && err.message.startsWith("Task not found");
      this.sendJson(res, isNotFound ? 404 : 500, {
        error: isNotFound ? err.message : "Internal server error",
      });
      return;
    }

    // ─── Static files — serve UI ───

    const rawPath =
      url === "/" || url === "/index.html"
        ? join(UI_DIR, "index.html")
        : join(UI_DIR, url.replace(/^\//, ""));

    // Path traversal protection
    const resolvedPath = resolve(rawPath);
    if (!resolvedPath.startsWith(UI_DIR + sep) && resolvedPath !== UI_DIR) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    try {
      const content = await readFile(resolvedPath, "utf-8");
      const ext = resolvedPath.split(".").pop() ?? "";
      const contentTypes: Record<string, string> = {
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        svg: "image/svg+xml",
        png: "image/png",
      };
      res.writeHead(200, {
        "Content-Type": contentTypes[ext] ?? "text/plain",
      });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  }
}

/**
 * Custom error class for input validation failures (→ 400 response).
 */
class KanbanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KanbanValidationError";
  }
}
