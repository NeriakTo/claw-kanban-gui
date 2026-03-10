import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import type { BoardEvent } from "../types.js";
import { BoardStore } from "../store/board-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UI_DIR = join(__dirname, "..", "ui");

/**
 * Lightweight HTTP + WebSocket server for the Kanban UI.
 *
 * - GET /           → serves the Kanban board HTML
 * - GET /api/board  → returns full board JSON
 * - GET /api/stats  → returns board stats JSON
 * - WS  /ws         → real-time board events
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

  private async handleHttp(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const url = req.url ?? "/";

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API endpoints
    if (url === "/api/board") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.store.getBoard()));
      return;
    }

    if (url === "/api/stats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(this.store.getStats()));
      return;
    }

    // Static files — serve UI
    const filePath =
      url === "/" || url === "/index.html"
        ? join(UI_DIR, "index.html")
        : join(UI_DIR, url.replace(/^\//, ""));

    try {
      const content = await readFile(filePath, "utf-8");
      const ext = filePath.split(".").pop() ?? "";
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
