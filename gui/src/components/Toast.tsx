import { useEffect } from "react";
import { useKanbanStore } from "../store/kanban-store";

export function ToastContainer() {
  const toasts = useKanbanStore((s) => s.toasts);
  const removeToast = useKanbanStore((s) => s.removeToast);

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  onDismiss: (id: string) => void;
}

const TYPE_STYLES: Record<string, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
};

function ToastItem({ id, type, message, onDismiss }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), 3000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-slide-in-right ${TYPE_STYLES[type]}`}
    >
      {message}
    </div>
  );
}
