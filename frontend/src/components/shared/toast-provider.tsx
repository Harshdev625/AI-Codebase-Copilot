"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function makeToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function iconForVariant(variant: ToastVariant): React.JSX.Element {
  if (variant === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (variant === "error") {
    return <TriangleAlert className="h-4 w-4 text-rose-500" />;
  }
  return <Info className="h-4 w-4 text-cyan-500" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const removeToast = React.useCallback((id: string): void => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = React.useCallback((toast: Omit<ToastItem, "id">): void => {
    const id = makeToastId();
    setToasts((previous) => [...previous, { ...toast, id }]);
    window.setTimeout(() => removeToast(id), 4200);
  }, [removeToast]);

  const value = React.useMemo<ToastContextValue>(() => ({
    showToast,
    success: (title, message) => showToast({ title, message, variant: "success" }),
    error: (title, message) => showToast({ title, message, variant: "error" }),
    info: (title, message) => showToast({ title, message, variant: "info" }),
  }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto animate-fade-up rounded-xl border px-4 py-3 text-foreground shadow-2xl backdrop-blur",
              toast.variant === "success" && "border-emerald-500/35 bg-emerald-500/10",
              toast.variant === "error" && "border-rose-500/35 bg-rose-500/10",
              toast.variant === "info" && "border-cyan-500/35 bg-cyan-500/10"
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{iconForVariant(toast.variant)}</div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.message ? <p className="mt-1 text-xs opacity-85">{toast.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-md p-1 opacity-80 transition hover:bg-white/10 hover:opacity-100"
                aria-label="Dismiss toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
