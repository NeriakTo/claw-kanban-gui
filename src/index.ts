/**
 * claw-kanban — OpenClaw plugin for visual task management
 *
 * Main entry point: exports everything needed for programmatic use.
 */

export { BoardStore, BoardStorage } from "./store/index.js";
export { SessionCollector } from "./collector/index.js";
export { KanbanServer } from "./server/index.js";
export { handleKanbanUpdate, handleKanbanQuery } from "./tools/index.js";
export type {
  Board,
  BoardStats,
  BoardEvent,
  Column,
  Task,
  Subtask,
  KanbanUpdateParams,
  KanbanQueryParams,
} from "./types.js";

// Export the activate function for OpenClaw
export { activate, register } from "./plugin.js";
