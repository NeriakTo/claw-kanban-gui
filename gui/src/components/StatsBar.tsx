import { useKanbanStore } from "../store/kanban-store";
import { COLUMNS, COLUMN_COLORS, COLUMN_LABELS } from "../types";

export function StatsBar() {
  const tasks = useKanbanStore((s) => s.tasks);

  const counts = COLUMNS.reduce(
    (acc, col) => {
      acc[col] = tasks.filter((t) => t.column === col).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="flex items-center gap-4">
      {COLUMNS.map((col) => (
        <div key={col} className="flex items-center gap-1.5 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: COLUMN_COLORS[col] }}
          />
          <span className="opacity-70">{COLUMN_LABELS[col]}</span>
          <span className="font-semibold">{counts[col]}</span>
        </div>
      ))}
    </div>
  );
}
