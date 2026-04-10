'use client';

import * as React from 'react';
import { useAuth } from '../hooks/use-auth';
import { Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
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
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your workspace to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="login-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                className="pl-11 h-11 border-border/50 bg-muted/20 focus:bg-background transition-all focus:border-primary/50"
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
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground" htmlFor="login-password">
                Password
              </label>
              <Link href="#" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11 h-11 border-border/50 bg-muted/20 focus:bg-background transition-all focus:border-primary/50"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 font-bold tracking-tight text-sm shadow-lg shadow-primary/15 hover:shadow-primary/25 transition-shadow"
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

      {/* Register link */}
      <div className="text-center text-sm text-muted-foreground/70">
        New to the platform?{' '}
        <Link href="/register" className="font-bold text-foreground hover:text-primary transition-colors">
          Create an account
        </Link>
      </div>
    </div>
  );
}
