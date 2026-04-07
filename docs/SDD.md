# Claw-Kanban GUI — System Design Document

> Version: 1.0
> Date: 2026-04-07
> Author: CC (Claude Code)
> Status: Approved

---

## 1. Overview

### 1.1 Purpose
為 claw-kanban CLI 新增 Web GUI，提供看板視覺化、拖放操作、即時更新、統計儀表板功能。

### 1.2 Scope
- 擴充 claw-kanban server 新增 REST 寫入 API
- 建立 React SPA 作為前端 GUI
- WebSocket 即時事件同步
- 整合至現有 `ui/` 靜態檔案服務架構

### 1.3 Architecture

```
┌──────────────────────────────────────────┐
│              React SPA (gui/)            │
│  Vite 6 + React 19 + TypeScript 5.7     │
│  Tailwind CSS 4 + Zustand 5 + @dnd-kit  │
└──────────────┬───────────────────────────┘
               │ HTTP + WebSocket
               ▼
┌──────────────────────────────────────────┐
│        KanbanServer (src/server/)        │
│  GET  /api/board    → 完整看板資料       │
│  GET  /api/stats    → 統計資料           │
│  POST /api/tasks    → 建立任務           │
│  PUT  /api/tasks/:id → 更新任務          │
│  PUT  /api/tasks/:id/move → 移動欄位     │
│  PUT  /api/tasks/:id/complete → 完成     │
│  PUT  /api/tasks/:id/fail → 標記失敗     │
│  WS   /ws           → 即時事件推送       │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│        BoardStore (src/store/)           │
│  In-memory + JSON 持久化                 │
│  ~/.openclaw/data/kanban/board.json      │
└──────────────────────────────────────────┘
```

---

## 2. Server 端擴充

### 2.1 新增 REST 寫入端點

| Method | Path | Body | Action |
|--------|------|------|--------|
| POST | `/api/tasks` | `{ title, description?, column?, tags?, subtasks? }` | 建立任務 |
| PUT | `/api/tasks/:id` | `{ title?, description?, progress?, tags?, subtasks?, logMessage? }` | 更新任務 |
| PUT | `/api/tasks/:id/move` | `{ column }` | 移動至指定欄位 |
| PUT | `/api/tasks/:id/complete` | `{ result? }` | 標記完成 |
| PUT | `/api/tasks/:id/fail` | `{ result? }` | 標記失敗 |

### 2.2 CORS 擴充
現有 CORS 僅允許 GET/OPTIONS，需擴充支援 POST/PUT。

### 2.3 持久化觸發
每次 write API 呼叫後，觸發 BoardStorage.save()（已有 debounce 機制）。

### 2.4 WebSocket 廣播
所有 write API 操作完成後，透過現有 BoardStore.emit() 機制自動廣播至所有 WS 客戶端。

---

## 3. GUI 前端

### 3.1 技術棧

| 項目 | 選型 | 理由 |
|------|------|------|
| Framework | React 19 | 團隊標準 |
| Build | Vite 6 | 快速 HMR |
| Language | TypeScript 5.7 | 型別安全 |
| Styling | Tailwind CSS 4 | Utility-first |
| State | Zustand 5 | 輕量、不可變更新 |
| DnD | @dnd-kit/core + @dnd-kit/sortable | 看板拖放 |

### 3.2 頁面結構

```
App
├── Header (logo, stats bar, theme toggle)
├── Board (main content)
│   ├── Column × 5 (backlog, in_progress, review, done, failed)
│   │   ├── ColumnHeader (title, count, color dot)
│   │   └── TaskCard × N (draggable)
│   │       ├── Title
│   │       ├── ProgressBar
│   │       ├── Tags
│   │       └── Subtask count
│   └── DndContext (drag overlay)
├── TaskDetail (slide-over panel)
│   ├── Title (editable)
│   ├── Description (editable)
│   ├── Progress slider
│   ├── Tags editor
│   ├── Subtasks (checkable)
│   ├── Logs timeline
│   └── Actions (complete/fail/delete)
└── StatsPanel (toggle-able bottom drawer)
    ├── Column distribution bar chart
    ├── Completed today/week
    ├── Top tags
    └── Avg completion time
```

### 3.3 狀態管理 (Zustand Store)

```typescript
interface KanbanStore {
  // State
  board: Board | null;
  stats: BoardStats | null;
  selectedTaskId: string | null;
  wsConnected: boolean;

  // Actions
  fetchBoard: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createTask: (params: CreateTaskParams) => Promise<void>;
  updateTask: (id: string, params: UpdateTaskParams) => Promise<void>;
  moveTask: (id: string, column: Column) => Promise<void>;
  completeTask: (id: string, result?: string) => Promise<void>;
  failTask: (id: string, result?: string) => Promise<void>;
  selectTask: (id: string | null) => void;

  // WebSocket handlers
  handleWsEvent: (event: BoardEvent) => void;
}
```

### 3.4 Build 輸出

```
gui/                    # Vite 專案根目錄
├── src/
├── public/
├── vite.config.ts      # build.outDir = '../ui'
└── package.json

Build 產出 → ui/        # 覆寫現有 ui/index.html
                        # server 直接從 ui/ 目錄服務靜態檔案
```

### 3.5 開發模式

```bash
# Terminal 1: claw-kanban server (port 18790)
claw-kanban serve  # 或由 OpenClaw gateway 自動啟動

# Terminal 2: Vite dev server (port 5173)
cd gui && npm run dev  # proxy /api + /ws → localhost:18790
```

---

## 4. Data Flow

### 4.1 初始載入
```
GUI mount → GET /api/board → render board
         → GET /api/stats → render stats
         → connect ws://localhost:18790/ws → receive full_refresh
```

### 4.2 拖放操作
```
User drags card → DnD onDragEnd
  → Optimistic UI update (Zustand)
  → PUT /api/tasks/:id/move { column }
  → Server updates BoardStore
  → BoardStore emits task_moved event
  → WS broadcasts to all clients
  → Other clients update UI
```

### 4.3 Task 編輯
```
User edits in TaskDetail panel
  → PUT /api/tasks/:id { title, description, ... }
  → Server updates BoardStore
  → WS broadcasts task_updated
  → All clients sync
```

---

## 5. Quality Gates

| Gate | Tool | Threshold |
|------|------|-----------|
| TypeScript | `tsc --noEmit` | Zero errors |
| Build | `vite build` | Success |
| Lint | `eslint` | Zero errors |

---

## 6. File Structure

```
claw-kanban-gui/
├── src/                       # 原有 CLI + server 原始碼
│   ├── server/
│   │   └── kanban-server.ts   # ← 新增 write API 端點
│   ├── store/
│   │   └── board-store.ts     # 不修改（已有完整 CRUD）
│   └── ...
├── gui/                       # ← 新增 React SPA
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── store/
│   │   │   └── kanban-store.ts
│   │   ├── components/
│   │   │   ├── Board.tsx
│   │   │   ├── Column.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskDetail.tsx
│   │   │   ├── Header.tsx
│   │   │   └── StatsPanel.tsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── types.ts
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
├── ui/                        # Build 輸出（由 vite build 產生）
├── docs/
│   └── SDD.md                 # 本文件
└── ...
```
