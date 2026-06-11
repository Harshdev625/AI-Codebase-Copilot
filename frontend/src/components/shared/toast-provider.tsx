"use client";

import * as React from "react";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type ToastVariant = "success" | "error" | "info" | "warning";

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
  warning: (title: string, message?: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function makeToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function iconForVariant(variant: ToastVariant): React.JSX.Element {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="h-5 w-5 text-success drop-shadow-[0_0_8px_rgba(var(--success),0.5)]" />;
    case "error":
      return <X className="h-5 w-5 text-destructive drop-shadow-[0_0_8px_rgba(var(--destructive),0.5)]" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-warning drop-shadow-[0_0_8px_rgba(var(--warning),0.5)]" />;
    case "info":
    default:
      return <Info className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" />;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const timersRef = React.useRef<Record<string, number>>({});

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(window.clearTimeout);
    };
  }, []);

  const removeToast = React.useCallback((id: string): void => {
    if (timersRef.current[id]) {
      window.clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = React.useCallback((toast: Omit<ToastItem, "id">): void => {
    const id = makeToastId();
    setToasts((previous) => [...previous, { ...toast, id }]);
    
    timersRef.current[id] = window.setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  const value = React.useMemo<ToastContextValue>(() => ({
    showToast,
    success: (title, message) => showToast({ title, message, variant: "success" }),
    error: (title, message) => showToast({ title, message, variant: "error" }),
    info: (title, message) => showToast({ title, message, variant: "info" }),
    warning: (title, message) => showToast({ title, message, variant: "warning" }),
  }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 sm:bottom-auto sm:top-6 right-0 sm:right-6 z-[200] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "pointer-events-auto w-full rounded-2xl border px-4 py-3.5 shadow-premium backdrop-blur-xl transition-colors",
                toast.variant === "success" && "border-success/30 bg-success/10 text-foreground",
                toast.variant === "error" && "border-destructive/30 bg-destructive/10 text-foreground",
                toast.variant === "info" && "border-primary/30 bg-primary/10 text-foreground",
                toast.variant === "warning" && "border-warning/30 bg-warning/10 text-foreground"
              )}
            >
              <div className="flex items-start gap-3.5">
                <div className="shrink-0 mt-0.5">{iconForVariant(toast.variant)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold tracking-tight">{toast.title}</p>
                  {toast.message && (
                    <p className="mt-1 text-xs font-medium opacity-80 leading-relaxed">
                      {toast.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 rounded-lg p-1.5 opacity-60 transition hover:bg-foreground/10 hover:opacity-100 focus:outline-none"
                  aria-label="Dismiss toast"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
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
