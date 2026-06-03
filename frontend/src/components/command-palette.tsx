"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Command, Search, Database, MessageSquarePlus, FileText, Settings2, Zap, BrainCircuit, ActivitySquare } from "lucide-react";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const runCommand = (command: () => void) => {
    setIsOpen(false);
    command();
  };

  const groups = [
    {
      heading: "Workspaces",
      items: [
        { icon: <Database className="w-4 h-4 text-primary" />, label: "Switch Repository...", action: () => runCommand(() => router.push("/repositories")) },
      ]
    },
    {
      heading: "New Session",
      items: [
        { icon: <MessageSquarePlus className="w-4 h-4 text-ai" />, label: "New ASK Session", action: () => runCommand(() => {}) },
        { icon: <BrainCircuit className="w-4 h-4 text-plan" />, label: "New PLAN Session", action: () => runCommand(() => {}) },
        { icon: <ActivitySquare className="w-4 h-4 text-act" />, label: "New ACT Session", action: () => runCommand(() => {}) },
      ]
    },
    {
      heading: "Search",
      items: [
        { icon: <FileText className="w-4 h-4 text-muted-foreground" />, label: "Search Files...", action: () => runCommand(() => {}) },
        { icon: <Search className="w-4 h-4 text-muted-foreground" />, label: "Search Sessions...", action: () => runCommand(() => {}) },
      ]
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl gap-0 rounded-xl" showCloseButton={false}>
        <div className="flex items-center border-b border-border/40 px-4 py-3 bg-card/20">
          <Command className="w-4 h-4 mr-3 text-muted-foreground" />
          <input 
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground focus:ring-0"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar space-y-4 bg-black/20">
          {groups.map((group, i) => (
            <div key={i}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.heading}</div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item, j) => (
                  <button
                    key={j}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md hover:bg-primary/10 hover:text-primary transition-colors focus:bg-primary/10 focus:text-primary focus:outline-none w-full group"
                    onClick={item.action}
                  >
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
