'use client';

import * as React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export function AuthenticationLoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Heading */}
      <motion.div variants={itemVariants} className="space-y-3 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
          <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            Developer Sign In
          </span>
        </div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground font-light">
          Continue your build with a focused workspace.
        </p>
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-5">
          {/* Email */}
          <motion.div variants={itemVariants} className="space-y-2">
            <label
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
              htmlFor="login-email"
            >
              Email Address
            </label>
            <div
              className={cn(
                "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
                focusedField === 'email' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
              )}
            >
              <Mail className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                focusedField === 'email' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                className="w-full bg-transparent h-12 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                required
                autoComplete="email"
              />
              <div className={cn(
                "absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-primary to-blue-500 transition-all duration-500",
                focusedField === 'email' ? "w-full" : "w-0"
              )} />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div variants={itemVariants} className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                htmlFor="login-password"
              >
                Password
              </label>
              <Link
                href="#"
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary hover:text-primary/80 transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div
              className={cn(
                "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
                focusedField === 'password' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
              )}
            >
              <Lock className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                focusedField === 'password' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="w-full bg-transparent h-12 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <div className={cn(
                "absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-primary to-blue-500 transition-all duration-500",
                focusedField === 'password' ? "w-full" : "w-0"
              )} />
            </div>
          </motion.div>
        </div>

        {/* Submit */}
        <motion.div variants={itemVariants} className="pt-2">
          <Button
            type="submit"
            id="login-submit"
            className="group relative w-full h-12 overflow-hidden rounded-xl font-semibold tracking-wide text-sm text-primary-foreground transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)] border-0"
            disabled={isLoggingIn}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-blue-500 to-primary bg-[length:200%_auto] animate-gradient" />
            <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLoggingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Workspace
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </span>
          </Button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div variants={itemVariants} className="relative flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-border" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-border" />
      </motion.div>

      {/* Links */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="text-center text-[13px] text-muted-foreground">
          New to the platform?{' '}
          <Link
            href="/register"
            className="font-semibold text-foreground hover:text-primary transition-colors underline decoration-border underline-offset-4 hover:decoration-primary/50"
          >
            Create an account
          </Link>
        </div>
        <div className="text-center text-[12px] text-muted-foreground/60">
          Admin access?{' '}
          <Link href="/admin/login" className="font-medium hover:text-primary transition-colors">
            Sign in as admin
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
