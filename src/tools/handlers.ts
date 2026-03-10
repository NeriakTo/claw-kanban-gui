import type { KanbanUpdateParams, KanbanQueryParams } from "../types.js";
import { BoardStore } from "../store/board-store.js";
import { loadTemplate } from "../templates/loader.js";

/**
 * Tool handler for kanban_update — called by OpenClaw when the agent
 * invokes the kanban_update tool defined in openclaw.plugin.json.
 */
export function handleKanbanUpdate(
  store: BoardStore,
  params: KanbanUpdateParams
): { success: boolean; task: unknown; message: string } {
  try {
    // START TEMPLATE INJECTION
    if (params.action === "create" && params.template) {
      const template = loadTemplate(params.template);
      if (template) {
        // If a template is found, enhance the creation params
        params.description = params.description || template.description;
        params.tags = [...(params.tags || []), ...template.tags];
        params.subtasks = template.subtasks; // This is the key part
      }
    }
    // END TEMPLATE INJECTION

    // ⭐️⭐️⭐️ DEBUGGING LOG ⭐️⭐️⭐️
    console.log('[Kanban Debug] Final params passed to store.handleUpdate:', JSON.stringify(params, null, 2));

    const task = store.handleUpdate(params);
    const verb =
      params.action === "create"
        ? "Created"
        : params.action === "complete"
          ? "Completed"
          : params.action === "fail"
            ? "Marked as failed"
            : params.action === "move"
              ? `Moved to ${task.column}`
              : "Updated";
    return {
      success: true,
      task: formatTaskCompact(task),
      message: `${verb}: ${task.title}`,
    };
  } catch (err) {
    return {
      success: false,
      task: null,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Tool handler for kanban_query — called by OpenClaw when the agent
 * invokes the kanban_query tool defined in openclaw.plugin.json.
 */
export function handleKanbanQuery(
  store: BoardStore,
  params: KanbanQueryParams
): unknown {
  try {
    const result = store.handleQuery(params);

    if (params.query === "stats") {
      return { success: true, stats: result };
    }

    if (params.query === "list" || params.query === "search") {
      const tasks = result as unknown[];
      return {
        success: true,
        count: tasks.length,
        tasks: (tasks as any[]).map(formatTaskCompact),
      };
    }

    if (params.query === "detail") {
      return { success: true, task: result };
    }

    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      message: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Compact task representation for LLM consumption — avoids bloating the context.
 */
function formatTaskCompact(task: any): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    column: task.column,
    progress: task.progress,
    tags: task.tags,
    subtasks: `${task.subtasks?.filter((s: any) => s.done).length ?? 0}/${task.subtasks?.length ?? 0}`,
    session: task.sessionId?.slice(0, 8) ?? null,
    updated: task.updatedAt,
  };
}
