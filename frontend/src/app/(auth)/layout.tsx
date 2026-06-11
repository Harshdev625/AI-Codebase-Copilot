'use client';

import * as React from 'react';
import { Command, Radar, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

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
];

function HighlightCard({ title, description, icon: Icon, index }: {
  title: string;
  description: string;
  icon: React.ElementType;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 + index * 0.1, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 shadow-2xl backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/10"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)]">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-white/90">{title}</h3>
        <p className="mt-1.5 text-xs text-white/60 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0A0B] selection:bg-primary/30">
      {/* Dynamic Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] h-[70vw] w-[70vw] rounded-full bg-primary/10 blur-[120px] mix-blend-screen opacity-50 animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[60vw] w-[60vw] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-transparent opacity-[0.03] pointer-events-none mix-blend-overlay" />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        {/* Left Section - Branding & Value Prop */}
        <section className="hidden lg:flex relative flex-1 flex-col justify-between px-8 py-6 lg:px-12 xl:px-20">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_0_30px_rgba(var(--primary),0.4)]">
              <Command className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-bold text-white tracking-tight">AI Codebase Copilot</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/80">Developer Edition</p>
            </div>
          </motion.div>

          <div className="flex-1 flex flex-col justify-center max-w-xl space-y-6 py-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                Agentic Intelligence
              </div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-display font-semibold tracking-tight text-white leading-[1.1]">
                Build a calm, precise
                <span className="block mt-2 bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent animate-gradient bg-300%"> code intelligence studio.</span>
              </h1>
              <p className="mt-6 text-base sm:text-lg text-white/60 leading-relaxed max-w-lg font-light">
                Index, inspect, and interrogate your repositories without context switching. Experience a highly-focused, local-first environment tailored for deep technical work.
              </p>
            </motion.div>

            <div className="hidden md:grid gap-4 sm:grid-cols-2 pt-4">
              {highlights.map((item, index) => (
                <HighlightCard key={item.title} {...item} index={index} />
              ))}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="flex items-center gap-3 text-xs text-white/40 font-medium"
          >
            <ShieldCheck className="h-4 w-4 text-primary/70" />
            <span>Secure, local-first execution environment.</span>
          </motion.div>
        </section>

        {/* Right Section - Auth Form */}
        <section className="relative flex w-full flex-1 items-center justify-center p-6 lg:flex-none lg:w-[480px] xl:w-[540px] 2xl:w-[640px] lg:border-l lg:border-white/10 bg-black/20 backdrop-blur-2xl">
          <div className="w-full max-w-[400px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-3xl before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:opacity-10"
            >
              <div className="relative z-10">
                {children}
              </div>
            </motion.div>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="mt-8 text-center text-xs font-medium text-white/40"
            >
              Crafted for teams that want clarity, not noise.
            </motion.p>
          </div>
        </section>
      </div>
    </div>
  );
}