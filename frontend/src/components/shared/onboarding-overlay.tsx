'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Sparkles, FolderGit2, Bot, ArrowRight, ArrowLeft,
  X, CheckCircle, GitBranch, MessageSquare, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/store/onboarding-store';
import { useAuthStore } from '@/store/auth-store';

interface Step {
  id: number;
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  ctaHref?: string;
  color: string;
  bgColor: string;
}

const steps: Step[] = [
  {
    id: 0,
    icon: <Sparkles className="h-8 w-8" />,
    badge: 'Welcome',
    title: 'Your AI Codebase Partner',
    description: 'AI Codebase Copilot understands your entire repository — not just searches it. Ask questions in plain English and get precise, code-aware answers.',
    detail: 'Powered by agentic RAG + LangGraph, it reasons across your full codebase to give you architectural insight in seconds.',
    cta: "Let's get started",
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 1,
    icon: <FolderGit2 className="h-8 w-8" />,
    badge: 'Step 1 of 3',
    title: 'Create a Project',
    description: 'Projects group related repositories together. Start by creating your first project — give it a meaningful name like "Backend Services" or "Mobile App".',
    detail: 'Projects are being simplified in the refactor; start by linking a repository.',
    cta: 'Create my first project',
    ctaHref: '/repositories',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    id: 2,
    icon: <GitBranch className="h-8 w-8" />,
    badge: 'Step 2 of 3',
    title: 'Add a Repository',
    description: 'Connect a GitHub URL or point to a local path. The AI will index your codebase — parsing functions, classes, and relationships — and store them as semantic vectors.',
    detail: 'Indexing typically takes 1-5 minutes. You’ll see real-time progress as chunks are stored.',
    cta: 'Add my first repository',
    ctaHref: '/repositories',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    id: 3,
    icon: <MessageSquare className="h-8 w-8" />,
    badge: 'Step 3 of 3',
    title: 'Start Your First Chat',
    description: 'Once indexed, head to the Chat workspace and ask anything: "Where is authentication handled?", "Explain the payment flow", "Why is this function slow?"',
    detail: 'The AI cites exact source files and functions.',
    cta: 'Open Chat workspace',
    ctaHref: '/chat',
    color: 'text-ai',
    bgColor: 'bg-ai/10',
  },
];

export function OnboardingOverlay() {
  const { isOpen, currentStep, nextStep, prevStep, completeOnboarding, initializeForUser, dismissOnboarding } =
    useOnboardingStore();
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  React.useEffect(() => {
    initializeForUser(user?.id ?? null);
  }, [user?.id]); // Only depend on user ID, not the function reference

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const handleCta = () => {
    if (step.ctaHref) {
      router.push(step.ctaHref);
    }
    if (isLast) {
      completeOnboarding();
    } else {
      nextStep();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-lg"
          >
            <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card shadow-2xl shadow-black/20">
              {/* Brand glow */}
              <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-72 rounded-full bg-primary/10 blur-[80px]" />

              {/* Close */}
              <button
                onClick={dismissOnboarding}
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-muted/40 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Step dots */}
              <div className="flex items-center gap-1.5 px-8 pt-6">
                {steps.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'h-1 rounded-full transition-all duration-400',
                      s.id === currentStep ? 'w-6 bg-primary' : 'w-1.5 bg-border',
                      s.id < currentStep && 'bg-primary/40'
                    )}
                  />
                ))}
              </div>

              {/* Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="px-8 py-6 space-y-5"
                >
                  {/* Icon */}
                  <div className={cn('inline-flex rounded-2xl p-3.5', step.bgColor, step.color)}>
                    {step.icon}
                  </div>

                  {/* Badge */}
                  <div className="inline-flex items-center rounded-full border border-border/40 bg-muted/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                    {step.badge}
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">{step.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>

                  {/* Detail box */}
                  <div className="rounded-xl bg-muted/40 border border-border/30 p-4">
                    <div className="flex items-start gap-2.5">
                      <Zap className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Actions */}
              <div className="flex items-center justify-between border-t border-border/30 px-8 py-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="gap-2 text-muted-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={dismissOnboarding}
                    className="text-[11px] font-semibold text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  >
                    Skip tour
                  </button>
                  <Button onClick={handleCta} className="gap-2">
                    {isLast ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        {step.cta}
                      </>
                    ) : (
                      <>
                        {step.cta}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
