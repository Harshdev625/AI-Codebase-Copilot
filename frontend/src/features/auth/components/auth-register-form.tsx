'use client';

import * as React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter',      met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',      met: /[a-z]/.test(password) },
    { label: 'Number or symbol',      met: /[\d\W]/.test(password) },
  ];
  const strength = checks.filter((c) => c.met).length;

  const barColor =
    strength <= 1 ? 'from-error to-error' :
    strength === 2 ? 'from-warning to-warning' :
    strength === 3 ? 'from-blue-400 to-primary' :
    'from-success to-success';

  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }} 
      animate={{ opacity: 1, height: 'auto' }} 
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 space-y-3 overflow-hidden"
    >
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden relative"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: i <= strength ? '100%' : '0%' }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn('absolute inset-0 rounded-full bg-gradient-to-r', barColor)}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-1">
        {checks.map((c, idx) => (
          <motion.div 
            key={c.label} 
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-1.5"
          >
            {c.met ? (
               <CheckCircle className="h-3.5 w-3.5 text-success shrink-0 rounded-full bg-success/10" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={cn('text-[10px] tracking-wide transition-colors duration-300', c.met ? 'text-foreground/80 font-medium' : 'text-muted-foreground')}>
              {c.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function AuthenticationRegisterForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  
  const { register, isRegistering } = useAuth();

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordMismatch) return;
    register({ email, password, full_name: fullName });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
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
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="space-y-2 text-center sm:text-left">
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">Create Account</h1>
        <p className="text-sm text-muted-foreground font-light">
          Build your workspace and start indexing immediately.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          
          {/* Full Name */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-name">
              Full Name
            </label>
            <div className={cn(
              "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
              focusedField === 'name' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
            )}>
              <UserIcon className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                focusedField === 'name' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="reg-name"
                type="text"
                placeholder="John Doe"
                className="w-full bg-transparent h-11 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                autoComplete="name"
              />
              <div className={cn(
                "absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-primary to-blue-500 transition-all duration-500",
                focusedField === 'name' ? "w-full" : "w-0"
              )} />
            </div>
          </motion.div>

          {/* Email */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-email">
              Email Address
            </label>
            <div className={cn(
              "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
              focusedField === 'email' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
            )}>
              <Mail className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                focusedField === 'email' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="reg-email"
                type="email"
                placeholder="name@example.com"
                className="w-full bg-transparent h-11 pl-12 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
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
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-password">
              Password
            </label>
            <div className={cn(
              "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
              focusedField === 'password' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
            )}>
              <Lock className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                focusedField === 'password' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                className="w-full bg-transparent h-11 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                required
                autoComplete="new-password"
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
            <AnimatePresence>
              {password.length > 0 && <PasswordStrength password={password} />}
            </AnimatePresence>
          </motion.div>

          {/* Confirm Password */}
          <motion.div variants={itemVariants} className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-confirm">
              Confirm Password
            </label>
            <div className={cn(
              "relative group overflow-hidden rounded-xl border bg-card/40 backdrop-blur-md transition-all duration-300",
              passwordMismatch ? "border-error/50 shadow-[0_0_15px_rgba(var(--error),0.2)] bg-error/10" :
              focusedField === 'confirm' ? "border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)] bg-card/80" : "border-border/40 hover:border-border/60 hover:bg-card/60"
            )}>
              <Lock className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors duration-300",
                passwordMismatch ? "text-error" :
                focusedField === 'confirm' ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
              )} />
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                className="w-full bg-transparent h-11 pl-12 pr-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <div className={cn(
                "absolute bottom-0 left-0 h-[2px] transition-all duration-500",
                passwordMismatch ? "w-full bg-error" :
                focusedField === 'confirm' ? "w-full bg-gradient-to-r from-primary to-blue-500" : "w-0"
              )} />
            </div>
            <AnimatePresence>
              {passwordMismatch && (
                <motion.p 
                  initial={{ opacity: 0, height: 0, y: -5 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -5 }}
                  className="text-[11px] text-error font-medium mt-1.5"
                >
                  Passwords don&apos;t match
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="pt-2">
          <Button
            type="submit"
            className={cn(
              "group relative w-full h-12 overflow-hidden rounded-xl font-semibold tracking-wide text-sm text-primary-foreground transition-all duration-300 border-0",
              isRegistering || passwordMismatch ? "opacity-70 cursor-not-allowed" : "hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
            )}
            disabled={isRegistering || passwordMismatch}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-blue-500 to-primary bg-[length:200%_auto] animate-gradient" />
            <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Workspace Account
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </span>
          </Button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="space-y-3 pt-2">
        <div className="text-center text-[13px] text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-foreground hover:text-primary transition-colors underline decoration-border underline-offset-4 hover:decoration-primary/50">
            Sign in
          </Link>
        </div>
        <div className="text-center text-[12px] text-muted-foreground/60">
          Need an admin seat?{' '}
          <Link href="/admin/register" className="font-medium hover:text-primary transition-colors">
            Register as admin
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
