'use client';

import * as React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

export function AuthenticationLoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const { login, isLoggingIn } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Heading */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/70">
            Developer Sign In
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Continue your build with a focused workspace.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
              htmlFor="login-email"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-email"
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
            <div className="flex items-center justify-between">
              <label
                className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground"
                htmlFor="login-password"
              >
                Password
              </label>
              <Link
                href="#"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70 hover:text-primary transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

        {/* Submit */}
        <Button
          type="submit"
          id="login-submit"
          className="w-full h-11 font-semibold tracking-tight text-sm shadow-md transition-all hover:shadow-lg"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Sign In to Workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-border/40" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      {/* Register link */}
      <div className="text-center text-[13px] text-muted-foreground">
        New to the platform?{' '}
        <Link
          href="/register"
          className="font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          Create an account
        </Link>
      </div>
      <div className="text-center text-[12px] text-muted-foreground">
        Admin access?{' '}
        <Link href="/admin/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Sign in as admin
        </Link>
      </div>
    </div>
  );
}
