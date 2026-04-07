import type { Board, BoardStats, Column, Task } from "../types";

const BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function fetchBoard(): Promise<Board> {
  return request<Board>("/board");
}

export function fetchStats(): Promise<BoardStats> {
  return request<BoardStats>("/stats");
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  column?: Column;
  tags?: string[];
  subtasks?: { title: string; done: boolean }[];
  progress?: number;
}

export function createTask(payload: CreateTaskPayload): Promise<Task> {
  return request<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  progress?: number;
  tags?: string[];
  subtasks?: { title: string; done: boolean }[];
  column?: Column;
  logMessage?: string;
}

export function updateTask(
  id: string,
  payload: UpdateTaskPayload
): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function moveTask(id: string, column: Column): Promise<Task> {
  return request<Task>(`/tasks/${id}/move`, {
    method: "PUT",
    body: JSON.stringify({ column }),
  });
}

export function completeTask(
  id: string,
  result?: string
): Promise<Task> {
  return request<Task>(`/tasks/${id}/complete`, {
    method: "PUT",
    body: JSON.stringify({ result }),
  });
}

export function failTask(id: string, result?: string): Promise<Task> {
  return request<Task>(`/tasks/${id}/fail`, {
    method: "PUT",
    body: JSON.stringify({ result }),
  });
}
