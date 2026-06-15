'use client';

import { motion } from 'framer-motion';

import { AUTH_FOOTER } from '@/features/auth/content/auth-copy';

export function AuthFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="relative z-30 shrink-0 border-t border-border/40 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgba(14,16,22,0.7)]"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 text-center">
        <p className="text-[11px] font-medium text-foreground/70 dark:text-muted-foreground">
          {AUTH_FOOTER.tagline} · {AUTH_FOOTER.copyright}
        </p>
        <p className="text-[10px] text-foreground/50 dark:text-muted-foreground/60">{AUTH_FOOTER.stack}</p>
      </div>
    </motion.footer>
  );
}
