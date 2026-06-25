'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { AuthFeatureItem, AuthPage } from '@/features/auth/content/auth-copy';
import { AUTH_MARKETING } from '@/features/auth/content/auth-copy';

interface AuthMarketingProps {
  page: AuthPage;
  className?: string;
  onNavigate?: () => void;
}

function BentoCard({
  feature,
  index,
}: {
  feature: AuthFeatureItem;
  index: number;
}) {
  const Icon = feature.icon;
  const hideClass =
    feature.hideBelow === '2xl'
      ? 'hidden 2xl:block'
      : feature.hideBelow === 'xl'
        ? 'hidden xl:block'
        : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.12 + index * 0.07, ease: 'easeOut' }}
      className={cn('min-h-[132px]', feature.className, hideClass)}
    >
      <div className="group relative h-full overflow-hidden rounded-2xl border border-indigo-200/30 bg-white/60 p-4 backdrop-blur-xl transition-all duration-300 hover:border-indigo-300/50 hover:bg-white/80 hover:shadow-lg hover:shadow-indigo-500/5 dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-indigo-400/25 dark:hover:bg-white/[0.07] dark:hover:shadow-none">
        {feature.accent && (
          <div
            className={cn(
              'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80',
              feature.accent
            )}
          />
        )}
        <div className="relative z-10 flex h-full flex-col">
          <div
            className={cn(
              'mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-background/25 shadow-inner',
              feature.iconClass ?? 'text-indigo-400'
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight text-foreground">
            {feature.title}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export function AuthMarketing({ page, className, onNavigate }: AuthMarketingProps) {
  const copy = AUTH_MARKETING[page];

  return (
    <div className={cn('flex flex-col justify-center space-y-7', className)}>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-5"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-300/40 bg-indigo-50 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-600 dark:border-indigo-400/25 dark:bg-indigo-500/10 dark:text-indigo-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
          </span>
          {copy.badge}
        </div>

        <h2 className="font-display text-[2rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-[2.35rem] xl:text-[2.75rem] 2xl:text-[3rem]">
          {copy.headline}
          <span className="mt-1 block bg-gradient-to-r from-indigo-500 via-violet-400 to-indigo-300 bg-clip-text text-transparent dark:from-indigo-400 dark:via-violet-300 dark:to-indigo-200">
            {copy.headlineAccent}
          </span>
        </h2>

        <p className="max-w-lg text-base leading-relaxed text-muted-foreground xl:text-[1.05rem]">
          {copy.description}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {copy.features.map((feature, index) => (
          <BentoCard key={feature.title} feature={feature} index={index} />
        ))}
      </div>

      {onNavigate && (
        <button
          type="button"
          onClick={onNavigate}
          className="text-sm font-medium text-indigo-500 hover:underline lg:hidden dark:text-indigo-300"
        >
          Close
        </button>
      )}
    </div>
  );
}
