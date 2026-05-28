'use client';

import * as React from 'react';
import { Command, Radar, ShieldCheck, Sparkles } from 'lucide-react';

const highlights = [
  {
    title: 'Signal-first indexing',
    description: 'Track code changes with precise repository fingerprints and fast re-indexing.',
    icon: Radar,
  },
  {
    title: 'Cited answers',
    description: 'Every response links back to the exact file and function that informed it.',
    icon: Sparkles,
  },
  {
    title: 'Local by default',
    description: 'Run fully on your machine with zero data leaving your workspace.',
    icon: ShieldCheck,
  },
];

function HighlightCard({ title, description, icon: Icon }: {
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 aurora-bg opacity-70" />
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />

      <div className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative flex flex-col justify-between px-6 py-10 sm:px-10 lg:px-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow-sm">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">AI Codebase Copilot</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Studio Edition</p>
            </div>
          </div>

          <div className="max-w-xl space-y-6 py-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Agentic Intelligence
            </div>
            <h1 className="text-4xl sm:text-5xl font-display tracking-tight text-foreground">
              Build a calm, precise
              <span className="gradient-text"> code intelligence studio</span>.
            </h1>
            <p className="text-base text-muted-foreground">
              Index, inspect, and interrogate your repositories without context switching. Everything you need stays
              in one focused workspace.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => (
                <HighlightCard key={item.title} {...item} />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Runs locally with model control, indexing, and audit-friendly access.</span>
          </div>
        </section>

        <section className="relative flex items-center justify-center border-t border-border/60 bg-card/70 px-6 py-10 backdrop-blur-xl lg:border-l lg:border-t-0">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-border/60 bg-card/90 p-6 shadow-xl sm:p-8">
              {children}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Crafted for teams that want clarity, not noise.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}