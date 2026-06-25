'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

function resolveIsDark(theme: string | undefined): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolveIsDark(resolvedTheme ?? theme);

  const handleToggle = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  if (!mounted) {
    return <div className="h-9 w-9 rounded-full bg-muted/20 animate-pulse" aria-hidden />;
  }

  const label =
    theme === 'system'
      ? `System theme (${isDark ? 'dark' : 'light'}). Click for light mode`
      : theme === 'light'
        ? 'Light mode. Click for dark mode'
        : 'Dark mode. Click for system theme';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className="relative h-9 w-9 rounded-full overflow-hidden hover:bg-card hover:shadow-premium transition-all duration-300 group bg-transparent border border-transparent hover:border-border/40 touch-target-sm"
      title={label}
      aria-label={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === 'system' ? (
          <motion.div
            key="system"
            initial={{ y: -20, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 20, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center text-muted-foreground"
          >
            <Monitor className="h-4 w-4" />
          </motion.div>
        ) : isDark ? (
          <motion.div
            key="moon"
            initial={{ y: -30, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 30, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center text-indigo-400 dark:text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          >
            <Moon className="h-4 w-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ y: -30, opacity: 0, rotate: -90 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: 30, opacity: 0, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          >
            <Sun className="h-4 w-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
}
