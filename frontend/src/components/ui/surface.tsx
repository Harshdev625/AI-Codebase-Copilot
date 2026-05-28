'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'elevated' | 'sunken' | 'interactive' | 'ghost';
  asChild?: boolean;
}

/**
 * Versatile surface component for consistent layering and containment.
 */
export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = 'flat', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl border transition-all duration-300',
          variant === 'flat'        && 'bg-card border-border/50 shadow-sm',
          variant === 'elevated'    && 'bg-card border-border/60 shadow-xl shadow-black/5',
          variant === 'sunken'      && 'bg-muted/40 border-border/30 shadow-inner',
          variant === 'interactive' && 'bg-card border-border/50 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-ai hover:bg-card/90',
          variant === 'ghost'       && 'bg-transparent border-transparent',
          className
        )}
        {...props}
      />
    );
  }
);
Surface.displayName = 'Surface';

interface GlassProps extends HTMLMotionProps<'div'> {
  intensity?: 'low' | 'medium' | 'high';
}

/**
 * Premium glassmorphic container with backdrop blurring and highlights.
 */
export const Glass = React.forwardRef<HTMLDivElement, GlassProps>(
  ({ className, intensity = 'medium', ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'relative border border-border/60 overflow-hidden rounded-2xl',
          intensity === 'low'    && 'bg-background/20 backdrop-blur-md',
          intensity === 'medium' && 'bg-background/40 backdrop-blur-xl',
          intensity === 'high'   && 'bg-background/60 backdrop-blur-2xl',
          className
        )}
        {...props}
      />
    );
  }
);
Glass.displayName = 'Glass';
