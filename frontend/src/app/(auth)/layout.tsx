'use client';

import * as React from 'react';
import { Command, Zap, GitBranch, MessageSquare, Search, Shield } from 'lucide-react';

/* ── Feature cards shown on right panel ──────────────────── */
const features = [
  {
    icon: Search,
    title: 'Semantic Code Search',
    desc: 'Natural language queries with function-level precision',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    glow: 'shadow-[0_0_16px_-4px_hsl(265,80%,60%,0.5)]',
  },
  {
    icon: GitBranch,
    title: 'Architecture Intel',
    desc: 'Instant dependency graphs and module relationships',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/20',
    glow: 'shadow-[0_0_16px_-4px_hsl(240,80%,65%,0.5)]',
  },
  {
    icon: Zap,
    title: 'Debugging Agent',
    desc: 'Paste a stack trace — receive root-cause analysis',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    glow: 'shadow-[0_0_16px_-4px_hsl(38,92%,50%,0.5)]',
  },
  {
    icon: MessageSquare,
    title: 'AI Refactoring',
    desc: 'Conversational code improvement with diff patches',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    glow: 'shadow-[0_0_16px_-4px_hsl(142,65%,45%,0.5)]',
  },
];

/* ── Animated terminal mock ──────────────────────────────── */
const TERMINAL_LINES = [
  { text: '> Where is auth implemented?', type: 'user',   delay: 0 },
  { text: '  Searching codebase index…',  type: 'system', delay: 0.7 },
  { text: '→ src/features/auth/use-auth.ts', type: 'result', delay: 1.3 },
  { text: '→ backend/app/api/auth.py',       type: 'result', delay: 1.7 },
  { text: '  JWT validation found at line 42.', type: 'answer', delay: 2.4 },
];

function AnimatedTerminal() {
  const [visible, setVisible] = React.useState<number[]>([]);

  React.useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    TERMINAL_LINES.forEach((line, i) => {
      timers.push(
        setTimeout(() => setVisible((prev) => [...prev, i]), line.delay * 1000)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const colorMap: Record<string, string> = {
    user:   'text-white font-semibold',
    system: 'text-zinc-500 italic',
    result: 'text-violet-400 font-medium',
    answer: 'text-emerald-400 font-semibold',
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-zinc-950/90 shadow-xl overflow-hidden">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/6 bg-zinc-950">
        <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-zinc-600 text-[10px] font-mono tracking-widest">ai-copilot ~ intelligence</span>
      </div>
      {/* Lines */}
      <div className="p-4 font-mono text-[12px] space-y-1.5 min-h-[110px]">
        {TERMINAL_LINES.map((line, i) =>
          visible.includes(i) ? (
            <div
              key={i}
              className={`${colorMap[line.type]} animate-fade-in`}
            >
              {line.text}
            </div>
          ) : null
        )}
        {visible.length < TERMINAL_LINES.length && (
          <span className="inline-block w-1.5 h-3.5 bg-violet-400 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
}

/* ── Floating glow orbs ──────────────────────────────────── */
function GlowOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-primary/12 blur-[120px] animate-float" />
      <div className="absolute -right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-[100px] animate-float delay-300" />
      <div className="absolute left-1/3 -bottom-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/8 blur-[100px] animate-float delay-500" />
    </div>
  );
}

/* ── Main auth layout ────────────────────────────────────── */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[hsl(240,18%,4%)] overflow-hidden">

      {/* ── Left: form column ─────────────────────────────── */}
      <div className="relative flex grow flex-col px-6 py-10 md:px-12 xl:px-20 lg:w-[46%]">
        {/* Dot grid BG */}
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />
        {/* Subtle left glow */}
        <div className="pointer-events-none absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[90px]" />

        {/* Logo */}
        <div className="relative flex items-center gap-3 mb-auto">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow-md">
            <Command className="h-5 w-5 text-white" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 opacity-30 blur-md -z-10" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight leading-none text-white">
              AI Codebase Copilot
            </span>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-violet-400/80 mt-0.5">
              Agentic Intelligence
            </p>
          </div>
        </div>

        {/* Form area */}
        <div className="relative mx-auto flex w-full max-w-sm flex-col justify-center gap-6 flex-1 py-20">
          {children}
        </div>

        {/* Footer */}
        <div className="relative text-center text-[10px] text-zinc-600 font-medium tracking-wide">
          © 2026 AI Codebase Copilot · Precision Code Intelligence ·{' '}
          <span className="text-violet-500/60">v2.0</span>
        </div>
      </div>

      {/* ── Right: showcase column ────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[54%] flex-col justify-center overflow-hidden border-l border-white/5 bg-[hsl(240,18%,3%)] p-14 xl:p-20">
        <GlowOrbs />

        {/* Dot grid overlay on right side */}
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-20" />

        {/* Status badge */}
        <div className="relative flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300 w-fit mb-10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-400" />
          </span>
          Agentic RAG · LangGraph Powered
        </div>

        {/* Headline */}
        <div className="relative space-y-5 max-w-lg mb-10">
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.1]">
            <span className="text-white">Unlock the</span>{' '}
            <span className="gradient-text-aurora">Intelligence</span>
            <br />
            <span className="text-white/80">hidden in your codebase.</span>
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed max-w-md">
            Ask in plain English. Get precise, grounded answers — right down to the function, file, and line. Powered by hybrid RAG and LangGraph agents.
          </p>
        </div>

        {/* Terminal demo */}
        <div className="relative max-w-md mb-10">
          <AnimatedTerminal />
        </div>

        {/* Feature cards grid */}
        <div className="relative grid grid-cols-2 gap-3 max-w-lg">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`group flex items-start gap-3 rounded-2xl border p-3.5 transition-all duration-300 hover:-translate-y-0.5 ${f.bg} ${f.glow} bg-transparent hover:bg-white/3`}
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${f.bg} ${f.color} transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className={`text-[11px] font-bold leading-tight ${f.color}`}>{f.title}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust strip */}
        <div className="relative mt-10 flex items-center gap-3 text-[10px] text-zinc-600 font-medium">
          <Shield className="h-3.5 w-3.5 text-zinc-600" />
          <span>Runs fully local — your code never leaves your machine</span>
        </div>
      </div>
    </div>
  );
}
