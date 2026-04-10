import * as React from 'react';
import { Command, Zap, GitBranch, MessageSquare, Search } from 'lucide-react';

const features = [
  {
    icon: Search,
    title: 'Semantic Code Search',
    desc: 'Ask questions in plain English, get precise file + function references',
    color: 'text-primary bg-primary/10',
  },
  {
    icon: GitBranch,
    title: 'Architecture Understanding',
    desc: 'Instantly map dependencies, call graphs, and module relationships',
    color: 'text-indigo-400 bg-indigo-400/10',
  },
  {
    icon: Zap,
    title: 'Debugging Agent',
    desc: 'Paste a stack trace and get root cause analysis with fix suggestions',
    color: 'text-amber-400 bg-amber-400/10',
  },
  {
    icon: MessageSquare,
    title: 'Conversational Refactor',
    desc: 'Ask the AI to refactor any module and receive diff-ready patches',
    color: 'text-emerald-400 bg-emerald-400/10',
  },
];

/* Animated terminal mock */
function TerminalMock() {
  const lines = [
    { text: '> Where is auth implemented?', delay: 0, role: 'user' },
    { text: 'Searching codebase...', delay: 0.6, role: 'system' },
    { text: '→ src/features/auth/hooks/use-auth.ts', delay: 1.2, role: 'result' },
    { text: '→ backend/app/api/auth.py', delay: 1.5, role: 'result' },
    { text: 'Found JWT token validation at line 42.', delay: 2.1, role: 'answer' },
  ];

  return (
    <div className="rounded-xl border border-white/8 bg-zinc-950 p-4 font-mono text-xs shadow-2xl">
      <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-white/5">
        <div className="h-2 w-2 rounded-full bg-rose-500/70" />
        <div className="h-2 w-2 rounded-full bg-amber-500/70" />
        <div className="h-2 w-2 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-zinc-500 text-[10px]">ai-copilot ~ session</span>
      </div>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.role === 'user'   ? 'text-white' :
              line.role === 'system' ? 'text-zinc-500 italic' :
              line.role === 'result' ? 'text-primary/90' :
                                       'text-emerald-400'
            }
            style={{
              animationDelay: `${line.delay}s`,
              animationDuration: '0.4s',
              animationFillMode: 'both',
              animationName: 'fadeUp',
            }}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background overflow-hidden">
      {/* ── Form column ────────────────────────────────────── */}
      <div className="flex grow flex-col justify-between px-6 py-10 md:px-12 lg:w-[48%] xl:px-20">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-white shadow-lg shadow-primary/30">
            <Command className="h-5 w-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight leading-none">AI Codebase Copilot</span>
            <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mt-0.5">Agentic Intelligence</p>
          </div>
        </div>

        {/* Form */}
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center gap-6">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-muted-foreground/40 font-medium">
          © 2026 AI Codebase Copilot · Precision Code Intelligence
        </div>
      </div>

      {/* ── Product showcase column ─────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[52%] flex-col justify-center overflow-hidden border-l border-border/20 bg-zinc-950 p-16">
        {/* Background glows */}
        <div className="pointer-events-none absolute -left-[15%] -top-[10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="pointer-events-none absolute -right-[10%] -bottom-[10%] h-[400px] w-[400px] rounded-full bg-indigo-500/8 blur-[120px]" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary/80 mb-8 w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          Agentic RAG · v4.5
        </div>

        {/* Headline */}
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-bold tracking-tight text-white leading-tight">
            Unlock the{' '}
            <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">
              Intelligence
            </span>{' '}
            hidden in your codebase.
          </h2>
          <p className="text-base text-zinc-400 leading-relaxed">
            Ask in plain English. Get precise answers grounded in real code — functions, files, and architecture.
          </p>
        </div>

        {/* Terminal mock */}
        <div className="mt-10 max-w-md">
          <TerminalMock />
        </div>

        {/* Features */}
        <div className="mt-10 grid grid-cols-2 gap-4 max-w-md">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/3 p-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${f.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white/90 leading-tight">{f.title}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
