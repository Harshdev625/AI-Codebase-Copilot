'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, User as UserIcon, Eye, EyeOff, KeyRound, Loader2, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';

export function AuthenticationAdminRegisterForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [adminSecret, setAdminSecret] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showSecret, setShowSecret] = React.useState(false);
  const { register, isRegistering } = useAdminAuth();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    register({ email, password, full_name: fullName, admin_secret_key: adminSecret });
  };

  return (
    <div className="space-y-7 animate-fade-up">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary/70">
            Admin Registration
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Create admin account</h1>
        <p className="text-sm text-muted-foreground">
          Secure access requires the secret key from the backend configuration.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="admin-reg-name">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="admin-reg-name"
                type="text"
                placeholder="Admin Name"
                className="pl-11"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="admin-reg-email">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="admin-reg-email"
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
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="admin-reg-password">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="admin-reg-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                className="pl-11 pr-11"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground" htmlFor="admin-reg-secret">
              Admin Secret Key
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
              <Input
                id="admin-reg-secret"
                type={showSecret ? 'text' : 'password'}
                placeholder="Paste secret key"
                className="pl-11 pr-11"
                value={adminSecret}
                onChange={(event) => setAdminSecret(event.target.value)}
                required
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full h-11 font-semibold tracking-tight text-sm shadow-lg shadow-primary/15" disabled={isRegistering}>
          {isRegistering ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <>
              Create admin access
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      <div className="text-center text-[12px] text-muted-foreground">
        Already have admin credentials?{' '}
        <Link href="/admin/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );
}
