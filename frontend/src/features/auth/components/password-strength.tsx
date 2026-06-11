'use client';

import * as React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';

export function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number or symbol', met: /[\d\W]/.test(password) },
  ];
  const strength = checks.filter((c) => c.met).length;

  const barColor =
    strength <= 1 ? 'from-error to-error' :
    strength === 2 ? 'from-warning to-warning' :
    strength === 3 ? 'from-blue-400 to-primary' :
    'from-success to-success';

  if (!password) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-2 space-y-3 overflow-hidden"
    >
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden relative">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: i <= strength ? '100%' : '0%' }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={cn('absolute inset-0 rounded-full bg-gradient-to-r', barColor)}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5 text-[11px]">
            {c.met ? (
              <CheckCircle className="h-3 w-3 text-success shrink-0" />
            ) : (
              <XCircle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            )}
            <span className={cn(c.met ? 'text-foreground/80' : 'text-muted-foreground')}>{c.label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function isPasswordStrong(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[\d\W]/.test(password)
  );
}
