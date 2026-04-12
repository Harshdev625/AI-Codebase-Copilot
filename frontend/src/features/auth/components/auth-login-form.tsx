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
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-violet-400/70">
            Developer Access
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white/90">Welcome back</h1>
        <p className="text-[13px] text-zinc-500">
          Sign in to your workspace to continue.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600"
              htmlFor="login-email"
            >
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
              <Input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                className="pl-11 h-11 border-white/8 bg-white/3 text-zinc-200 placeholder:text-zinc-700 focus:border-violet-500/40 focus:bg-white/5 focus:shadow-[0_0_0_1px_hsl(265,80%,65%,0.15)] transition-all"
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
                className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600"
                htmlFor="login-password"
              >
                Password
              </label>
              <Link
                href="#"
                className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-500/60 hover:text-violet-400 transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700" />
              <Input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="pl-11 pr-11 h-11 border-white/8 bg-white/3 text-zinc-200 placeholder:text-zinc-700 focus:border-violet-500/40 focus:bg-white/5 focus:shadow-[0_0_0_1px_hsl(265,80%,65%,0.15)] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-700 hover:text-zinc-400 transition-colors"
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
          className="w-full h-11 font-bold tracking-tight text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-glow-md hover:shadow-[0_0_32px_-4px_hsl(265,80%,65%,0.5)] transition-all hover:scale-[1.01] active:scale-[0.99]"
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
        <div className="flex-1 h-px bg-white/6" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">or</span>
        <div className="flex-1 h-px bg-white/6" />
      </div>

      {/* Register link */}
      <div className="text-center text-[13px] text-zinc-600">
        New to the platform?{' '}
        <Link
          href="/register"
          className="font-bold text-violet-400 hover:text-violet-300 transition-colors"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
