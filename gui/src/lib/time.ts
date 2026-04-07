export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function getTaskDuration(task: {
  startedAt: string | null;
  completedAt: string | null;
}): number | null {
  if (!task.startedAt) return null;
  const start = new Date(task.startedAt).getTime();
  const end = task.completedAt
    ? new Date(task.completedAt).getTime()
    : Date.now();
  return end - start;
}
