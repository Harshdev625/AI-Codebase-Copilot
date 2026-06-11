'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, FolderGit2, Bot, ArrowRight, Command, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(0);
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const allItems: CommandItem[] = React.useMemo(() => [
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      description: 'Overview and activity feed',
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: 'G D',
      category: 'Navigate',
      action: () => { router.push('/dashboard'); onClose(); },
    },
    {
      id: 'nav-repos',
      label: 'Go to Repositories',
      description: 'Manage connected codebases',
      icon: <FolderGit2 className="h-4 w-4" />,
      shortcut: 'G R',
      category: 'Navigate',
      action: () => { router.push('/repositories'); onClose(); },
    },
  ], [router, onClose]);

  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  // Focus input on open
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => (s + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => (s - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        filtered[selected]?.action();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, selected, onClose]);

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-xl mx-4 rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                placeholder="Search pages, actions, repositories..."
                className="flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground/40 focus:outline-none"
              />
              <div className="flex items-center gap-1">
                <kbd className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">ESC</kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[340px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Command className="h-8 w-8 text-muted-foreground/20 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => (
                  <div key={category} className="mb-2">
                    <div className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                      {category}
                    </div>
                    {items.map((item) => {
                      const globalIndex = filtered.indexOf(item);
                      return (
                        <button
                          key={item.id}
                          onClick={item.action}
                          onMouseEnter={() => setSelected(globalIndex)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            selected === globalIndex
                              ? 'bg-primary/8 text-foreground'
                              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                          )}
                        >
                          <div className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                            selected === globalIndex
                              ? 'border-primary/20 bg-primary/10 text-primary'
                              : 'border-border/40 bg-muted/20 text-muted-foreground'
                          )}>
                            {item.icon}
                          </div>
                          <div className="flex flex-1 flex-col min-w-0">
                            <span className="text-sm font-semibold truncate">{item.label}</span>
                            {item.description && (
                              <span className="text-[11px] text-muted-foreground/60 truncate">{item.description}</span>
                            )}
                          </div>
                          {item.shortcut && (
                            <div className="flex items-center gap-1 shrink-0">
                              {item.shortcut.split(' ').map((k, i) => (
                                <kbd key={i} className="rounded border border-border/50 bg-muted/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          )}
                          {selected === globalIndex && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/30 px-4 py-2.5">
              <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5">↑</kbd>
                  <kbd className="rounded border border-border/40 bg-muted/30 px-1 py-0.5">↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5">↵</kbd>
                  Open
                </span>
              </div>
              <button onClick={onClose} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
