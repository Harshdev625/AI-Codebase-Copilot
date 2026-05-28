'use client';

import * as React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Mail, Lock, User as UserIcon, Loader2, ArrowRight, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter',      met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter',      met: /[a-z]/.test(password) },
    { label: 'Number or symbol',      met: /[\d\W]/.test(password) },
  ];
  const strength = checks.filter((c) => c.met).length;

  const barColor =
    strength <= 1 ? 'bg-error' :
    strength === 2 ? 'bg-warning' :
    strength === 3 ? 'bg-warning' :
    'bg-success';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-all duration-300',
              i <= strength ? barColor : 'bg-muted/40'
            )}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.met ? (
              <CheckCircle className="h-4 w-4 text-success shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
            )}
            <span className={cn('text-[9px] font-semibold', c.met ? 'text-foreground/70' : 'text-muted-foreground/40')}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuthenticationRegisterForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [showStrength, setShowStrength] = React.useState(false);
  const { register, isRegistering } = useAuth();

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordMismatch) return;
    register({ email, password, full_name: fullName });
  };

  return (
    <div className="space-y-7 animate-fade-up">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">Create Account</h1>
        <p className="text-sm text-muted-foreground">
          Build your workspace and start indexing immediately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-name">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="reg-name"
                type="text"
                placeholder="John Doe"
                className="pl-11"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="reg-email"
                type="email"
                placeholder="name@example.com"
                className="pl-11"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                className="pl-11 pr-11"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setShowStrength(true); }}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {showStrength && password.length > 0 && <PasswordStrength password={password} />}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="reg-confirm">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className={cn('absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4', passwordMismatch ? 'text-error/60' : 'text-muted-foreground/40')} />
              <Input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                className={cn(
                  'pl-11 pr-11',
                  passwordMismatch ? 'border-error/50 focus:border-error/70' : 'border-border/60 focus:border-primary/40'
                )}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordMismatch && (
              <p className="text-[11px] text-error font-semibold mt-1">Passwords don&apos;t match</p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-semibold tracking-tight text-sm shadow-lg shadow-primary/15"
          disabled={isRegistering || passwordMismatch}
        >
          {isRegistering ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Create Workspace Account
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center text-sm text-muted-foreground/70">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-foreground hover:text-primary transition-colors">
          Sign in
        </Link>
      </div>
      <div className="text-center text-[12px] text-muted-foreground">
        Need an admin seat?{' '}
        <Link href="/admin/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Register as admin
        </Link>
      </div>
    </div>
  );
}
