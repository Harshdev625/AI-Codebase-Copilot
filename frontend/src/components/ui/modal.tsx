"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, description, onClose, children }: ModalProps): React.JSX.Element | null {
  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />
      <div
        className={cn(
          "relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
