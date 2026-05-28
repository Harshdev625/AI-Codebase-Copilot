'use client';

import * as React from 'react';
import Link from 'next/link';
import { KeyRound, Lock, Mail, Eye, EyeOff, Loader2, ArrowRight, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';

export function AuthenticationAdminLoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const { login, isLoggingIn } = useAdminAuth();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    login({ email, password });
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/70">
            Admin Sign In
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Secure control room</h1>
        <p className="text-sm text-muted-foreground">
          Access system health, repositories, and user management.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground" htmlFor="admin-login-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-login-email"
                type="email"
                placeholder="admin@example.com"
                className="pl-11"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground" htmlFor="admin-login-password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 font-semibold tracking-tight text-sm shadow-md" disabled={isLoggingIn}>
          {isLoggingIn ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Enter admin console
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center text-[12px] text-muted-foreground">
        Need to register?{' '}
        <Link href="/admin/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Create admin account
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5" />
        Admin access requires the secret key from your backend configuration.
      </div>
    </div>
  );
}
