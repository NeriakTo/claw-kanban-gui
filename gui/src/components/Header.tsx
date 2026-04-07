import { useState, useCallback, useEffect, useRef } from "react";
import { useKanbanStore } from "../store/kanban-store";
import { StatsBar } from "./StatsBar";
import { COLUMNS, COLUMN_LABELS } from "../types";

export function Header() {
  const theme = useKanbanStore((s) => s.theme);
  const toggleTheme = useKanbanStore((s) => s.toggleTheme);
  const setShowCreateDialog = useKanbanStore((s) => s.setShowCreateDialog);
  const wsConnected = useKanbanStore((s) => s.wsConnected);
  const setSearchQuery = useKanbanStore((s) => s.setSearchQuery);
  const filterTags = useKanbanStore((s) => s.filterTags);
  const toggleFilterTag = useKanbanStore((s) => s.toggleFilterTag);
  const showArchived = useKanbanStore((s) => s.showArchived);
  const setShowArchived = useKanbanStore((s) => s.setShowArchived);
  const tasks = useKanbanStore((s) => s.tasks);

  const [localQuery, setLocalQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Expose search input ref for keyboard shortcut
  useEffect(() => {
    const el = searchInputRef.current;
    if (el) {
      el.id = "kanban-search-input";
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
    },
    [setSearchQuery]
  );

  // Collect all unique tags from tasks
  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags))).sort();

  const isDark = theme === "dark";

  return (
    <header
      className={`flex flex-col border-b ${
        isDark
          ? "bg-surface-dark border-border-dark"
          : "bg-surface-light border-gray-200"
      }`}
    >
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl">&#x1F980;</span>
          <span
            className={`text-lg font-bold ${
              isDark ? "text-text-dark" : "text-text-light"
            }`}
          >
            Claw Kanban
          </span>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={searchInputRef}
              value={localQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜尋任務..."
              className={`w-full pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none border ${
                isDark
                  ? "bg-surface2-dark border-border-dark text-text-dark placeholder:text-gray-500"
                  : "bg-surface2-light border-gray-300 text-text-light placeholder:text-gray-400"
              } focus:border-accent`}
            />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Hidden on mobile: Stats */}
          <div
            className={`hidden lg:flex ${
              isDark ? "text-text-dark" : "text-text-light"
            }`}
          >
            <StatsBar />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${
              showFilters
                ? "bg-accent text-white"
                : isDark
                  ? "hover:bg-surface2-dark text-text-dark"
                  : "hover:bg-surface2-light text-text-light"
            }`}
            title="篩選"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </button>

          {/* WS indicator */}
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              wsConnected ? "bg-col-done" : "bg-col-failed"
            }`}
            title={wsConnected ? "WebSocket 已連線" : "WebSocket 已斷線"}
          />

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-colors ${
              isDark
                ? "hover:bg-surface2-dark text-text-dark"
                : "hover:bg-surface2-light text-text-light"
            }`}
            title={isDark ? "切換亮色主題" : "切換暗色主題"}
          >
            {isDark ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Create task */}
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-accent hover:opacity-90 transition-opacity"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            新增任務
          </button>
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div
          className={`flex flex-wrap items-center gap-3 px-6 py-2 border-t ${
            isDark ? "border-border-dark" : "border-gray-200"
          }`}
        >
          {/* Column filters */}
          <span
            className={`text-xs font-medium ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            欄位：
          </span>
          {COLUMNS.map((col) => {
            // Column filter uses filterTags with prefix "col:" internally
            const colTag = `col:${col}`;
            const active = filterTags.includes(colTag);
            return (
              <button
                key={col}
                onClick={() => toggleFilterTag(colTag)}
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                  active
                    ? "bg-accent text-white border-accent"
                    : isDark
                      ? "border-border-dark text-gray-400 hover:border-gray-500"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {COLUMN_LABELS[col]}
              </button>
            );
          })}

          {/* Separator */}
          <span
            className={`h-4 w-px ${isDark ? "bg-border-dark" : "bg-gray-300"}`}
          />

          {/* Tag filters */}
          <span
            className={`text-xs font-medium ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}
          >
            標籤：
          </span>
          {allTags.length === 0 ? (
            <span
              className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
            >
              無標籤
            </span>
          ) : (
            allTags.map((tag) => {
              const active = filterTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                    active
                      ? "bg-accent text-white border-accent"
                      : isDark
                        ? "border-border-dark text-gray-400 hover:border-gray-500"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {tag}
                </button>
              );
            })
          )}

          {/* Separator */}
          <span
            className={`h-4 w-px ${isDark ? "bg-border-dark" : "bg-gray-300"}`}
          />

          {/* Archived toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`text-xs px-2 py-1 rounded-md border transition-colors ${
              showArchived
                ? "bg-accent text-white border-accent"
                : isDark
                  ? "border-border-dark text-gray-400 hover:border-gray-500"
                  : "border-gray-300 text-gray-600 hover:border-gray-400"
            }`}
          >
            {showArchived ? "隱藏已歸檔" : "顯示已歸檔"}
          </button>
        </div>
      )}
    </header>
  );
}
