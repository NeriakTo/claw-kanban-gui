import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Board } from "../types.js";
import { BoardStore } from "./board-store.js";

const DATA_DIR = join(homedir(), ".openclaw", "data", "kanban");
const BOARD_FILE = join(DATA_DIR, "board.json");

/**
 * Persistent storage backed by local JSON file.
 * Watches for external changes (e.g. CLI operations) and reloads automatically.
 */
export class BoardStorage {
  private store: BoardStore;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private watcher: FSWatcher | null = null;
  private ignoreNextChange = false;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(store: BoardStore) {
    this.store = store;
    // Auto-save on changes
    store.subscribe(() => {
      this.dirty = true;
      this.scheduleSave();
    });
  }

  /**
   * Load board from disk. Returns false if no file exists (first run).
   */
  async load(): Promise<boolean> {
    if (!existsSync(BOARD_FILE)) {
      return false;
    }
    try {
      const raw = await readFile(BOARD_FILE, "utf-8");
      const board = JSON.parse(raw) as Board;
      this.store.setBoard(board);
      return true;
    } catch {
      // Corrupted file — start fresh
      return false;
    }
  }

  /**
   * Save board to disk immediately.
   */
  async save(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    const board = this.store.getBoard();
    const json = JSON.stringify(board, null, 2);
    this.ignoreNextChange = true;
    await writeFile(BOARD_FILE, json, "utf-8");
    this.dirty = false;
  }

  /**
   * Debounced save — coalesce rapid writes.
   */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      if (this.dirty) {
        await this.save().catch((err) =>
          console.error("[claw-kanban] save error:", err)
        );
      }
    }, 500);
  }

  /**
   * Start watching board.json for external changes (e.g. CLI operations).
   * On change, reloads the file and updates the in-memory BoardStore,
   * which triggers a WS broadcast to all connected GUI clients.
   */
  startWatching(): void {
    if (this.watcher) return;
    if (!existsSync(BOARD_FILE)) return;

    this.watcher = watch(BOARD_FILE, () => {
      // Ignore changes triggered by our own save
      if (this.ignoreNextChange) {
        this.ignoreNextChange = false;
        return;
      }

      // Debounce reload to avoid double-fire (common with fs.watch)
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(async () => {
        this.reloadTimer = null;
        try {
          const raw = await readFile(BOARD_FILE, "utf-8");
          const board = JSON.parse(raw) as Board;
          this.store.setBoard(board);
          console.log("[claw-kanban] Board reloaded from disk (external change detected)");
        } catch {
          // File might be mid-write, ignore
        }
      }, 200);
    });

    console.log("[claw-kanban] Watching board.json for external changes");
  }

  /**
   * Stop watching board.json.
   */
  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  /**
   * Data directory path (for reference).
   */
  static get dataDir(): string {
    return DATA_DIR;
  }

  static get boardFile(): string {
    return BOARD_FILE;
  }
}

export { BoardStore } from "./board-store.js";
