"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type ToastItem = {
  id: string;
  message: string;
  tone?: "info" | "success" | "warning";
};

export function MeetingToasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-xl border border-[var(--meet-border)] bg-[var(--meet-surface-elevated)] px-4 py-3 text-sm text-[var(--meet-text)] shadow-lg",
        toast.tone === "warning" && "border-[var(--meet-danger)]/40",
      )}
    >
      {toast.message}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(message: string, tone: ToastItem["tone"] = "info") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, pushToast, dismissToast };
}
