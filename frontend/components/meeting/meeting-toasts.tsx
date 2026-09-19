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
    <div className="pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-40 flex justify-center px-4 sm:bottom-28">
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
        "pointer-events-auto w-full max-w-sm rounded-2xl border border-white/12 bg-[#0c1220]/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-md",
        toast.tone === "warning" && "border-[var(--meet-danger)]/50",
        toast.tone === "success" && "border-[var(--meet-success)]/50",
      )}
    >
      {toast.message}
    </div>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(
    message: string,
    tone: ToastItem["tone"] = "info",
    _key?: string,
  ) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts([{ id, message, tone }]);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, pushToast, dismissToast };
}
