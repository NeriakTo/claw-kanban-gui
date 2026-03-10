import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Board } from "../types.js";
import { BoardStore } from "./board-store.js";

const DATA_DIR = join(homedir(), ".openclaw", "data", "kanban");
const BOARD_FILE = join(DATA_DIR, "board.json");

/**
 * Persistent storage backed by local JSON file.
 */
export class BoardStorage {
  private store: BoardStore;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

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
