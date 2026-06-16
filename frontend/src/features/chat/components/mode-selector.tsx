"use client";

import * as React from "react";
import { Search, PenTool, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMode } from "@/features/chat/types/chat-types";
import { motion } from "framer-motion";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  /** compact = inline composer row; default = centered hero layout */
  variant?: "default" | "compact";
}

const MODES = [
  {
    id: "ASK",
    label: "Ask",
    icon: Search,
    color: "bg-blue-500/15 text-blue-500",
    activeColor: "text-blue-500",
    description: "Explore and understand code",
  },
  {
    id: "PLAN",
    label: "Plan",
    icon: PenTool,
    color: "bg-purple-500/15 text-purple-500",
    activeColor: "text-purple-500",
    description: "Design and architect changes",
  },
  {
    id: "ACT",
    label: "Act",
    icon: PlayCircle,
    color: "bg-amber-500/15 text-amber-500",
    activeColor: "text-amber-500",
    description: "Generate executable patches",
  },
] as const;

export function ModeSelector({ mode, onModeChange, variant = "default" }: ModeSelectorProps) {
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];
  const isCompact = variant === "compact";
  const layoutId = isCompact ? "active-mode-compact" : "active-mode";

  return (
    <div
      className={cn(
        "flex flex-col",
        isCompact ? "w-full gap-1 px-1" : "items-center justify-center w-full mt-1 mb-2",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2 px-1">
        <div
          className={cn(
            "relative flex items-center bg-card/60 border border-border/40 shadow-sm backdrop-blur-xl",
            isCompact ? "p-0.5 rounded-lg" : "p-1 rounded-2xl",
          )}
        >
          {MODES.map((m) => {
            const isActive = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onModeChange(m.id as ChatMode)}
                className={cn(
                  "relative flex flex-1 items-center justify-center rounded-lg font-semibold transition-colors duration-200 z-10",
                  isCompact ? "space-x-1 px-2.5 py-1.5 text-xs min-w-[4.5rem]" : "space-x-2 px-5 py-2.5 rounded-xl text-sm",
                  isActive ? m.activeColor : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={layoutId}
                    className={cn("absolute inset-0 rounded-lg", m.color, !isCompact && "rounded-xl")}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("relative z-10", isCompact ? "w-3 h-3" : "w-4 h-4")} />
                <span className="relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
        {isCompact && (
          <span className="hidden min-w-0 flex-1 truncate text-right text-[10px] text-[#8B949E] sm:block">
            {activeMode.description}
          </span>
        )}
      </div>
      {!isCompact && (
        <p className="min-h-[1rem] text-[11px] mt-2 font-medium tracking-wide text-muted-foreground/70">
          {activeMode.description}
        </p>
      )}
    </div>
  );
}
