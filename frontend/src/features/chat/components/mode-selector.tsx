"use client";

import * as React from "react";
import { Search, PenTool, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMode } from "@/features/chat/types/chat-types";
import { motion } from "framer-motion";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
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

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const activeMode = MODES.find((m) => m.id === mode) || MODES[0];

  return (
    <div className="flex flex-col items-center justify-center w-full mt-1 mb-2">
      <div className="relative flex items-center bg-card/60 p-1 rounded-2xl border border-border/40 shadow-sm backdrop-blur-xl">
        {MODES.map((m) => {
          const isActive = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id as ChatMode)}
              className={cn(
                "relative flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 z-10",
                isActive ? m.activeColor : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-mode"
                  className={cn("absolute inset-0 rounded-xl", m.color)}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{m.label}</span>
            </button>
          );
        })}
      </div>
      <motion.p
        key={mode}
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[11px] text-muted-foreground/70 mt-2 font-medium tracking-wide"
      >
        {activeMode.description}
      </motion.p>
    </div>
  );
}
