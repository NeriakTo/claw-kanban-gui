import { useKanbanStore } from "../store/kanban-store";
import { StatsBar } from "./StatsBar";

export function Header() {
  const theme = useKanbanStore((s) => s.theme);
  const toggleTheme = useKanbanStore((s) => s.toggleTheme);
  const setShowCreateDialog = useKanbanStore((s) => s.setShowCreateDialog);
  const wsConnected = useKanbanStore((s) => s.wsConnected);

  return (
    <header
      className={`flex items-center justify-between px-6 py-3 border-b ${
        theme === "dark"
          ? "bg-surface-dark border-border-dark"
          : "bg-surface-light border-gray-200"
      }`}
    >
      {/* Left: Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xl">&#x1F980;</span>
        <span
          className={`text-lg font-bold ${
            theme === "dark" ? "text-text-dark" : "text-text-light"
          }`}
        >
          Claw Kanban
        </span>
      </div>

      {/* Center: Stats */}
      <div
        className={`hidden md:flex ${
          theme === "dark" ? "text-text-dark" : "text-text-light"
        }`}
      >
        <StatsBar />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3 shrink-0">
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
            theme === "dark"
              ? "hover:bg-surface2-dark text-text-dark"
              : "hover:bg-surface2-light text-text-light"
          }`}
          title={theme === "dark" ? "切換亮色主題" : "切換暗色主題"}
        >
          {theme === "dark" ? (
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
    </header>
  );
}
