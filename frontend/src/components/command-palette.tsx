"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { Command, Search, Database, MessageSquarePlus, History, Camera, GitPullRequestDraft, ArrowRight } from "lucide-react";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  
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
    setTimeout(() => setQuery(""), 150); // clear after animation
  };

  const groups = [
    {
      heading: "Navigation",
      items: [
        { icon: <Database className="w-4 h-4 text-primary" />, label: "Open Explorer (Repositories & Files)", action: () => runCommand(() => useStudioStore.getState().setSecondaryPanel('explorer')) },
        { icon: <History className="w-4 h-4 text-primary" />, label: "Open Sessions", action: () => runCommand(() => useStudioStore.getState().setSecondaryPanel(null)) },
        { icon: <GitPullRequestDraft className="w-4 h-4 text-primary" />, label: "Open Patches", action: () => runCommand(() => useStudioStore.getState().setSecondaryPanel('patches')) },
        { icon: <Camera className="w-4 h-4 text-primary" />, label: "Open Snapshots", action: () => runCommand(() => useStudioStore.getState().setSecondaryPanel('snapshots')) },
        { icon: <Search className="w-4 h-4 text-primary" />, label: "Search Files...", action: () => runCommand(() => useStudioStore.getState().setSecondaryPanel('search')) },
      ]
    },
    {
      heading: "New Session",
      items: [
        { icon: <MessageSquarePlus className="w-4 h-4 text-ai" />, label: "New Chat Session", action: () => runCommand(() => useStudioStore.getState().setActiveSessionId(null)) },
      ]
    }
  ];

  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
  })).filter(group => group.items.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-card/95 backdrop-blur-2xl border-border/40 shadow-2xl gap-0 rounded-2xl sm:rounded-3xl" showCloseButton={false}>
        {/* Hidden title/description for accessibility compliance */}
        <div className="sr-only">
            <DialogTitle>Command Palette</DialogTitle>
            <DialogDescription>Search for commands and quick actions</DialogDescription>
        </div>

        <div className="flex items-center border-b border-border/40 px-5 py-4 bg-background/40">
          <Search className="w-5 h-5 mr-3 text-muted-foreground/60" />
          <input 
            className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground/50 focus:ring-0 text-foreground"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 font-mono text-[11px] font-bold text-muted-foreground shadow-sm">
            ESC
          </kbd>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-3 custom-scrollbar space-y-5 bg-background/20">
          {filteredGroups.length === 0 ? (
            <div className="py-14 text-center flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 border border-border/40 mb-4 shadow-inner">
                <Command className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">No results found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Try a different search term.</p>
            </div>
          ) : (
            filteredGroups.map((group, i) => (
              <div key={i} className="space-y-2">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  {group.heading}
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map((item, j) => (
                    <button
                      key={j}
                      className="flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left transition-all duration-200 hover:bg-primary/10 hover:shadow-glow-sm focus:bg-primary/10 focus:outline-none group border border-transparent hover:border-primary/20"
                      onClick={item.action}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground group-hover:bg-primary/20 group-hover:border-primary/40 group-hover:scale-110 transition-all duration-300">
                         {item.icon}
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                        {item.label}
                      </span>
                      <ArrowRight className="w-4 h-4 shrink-0 text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-3 group-hover:translate-x-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
