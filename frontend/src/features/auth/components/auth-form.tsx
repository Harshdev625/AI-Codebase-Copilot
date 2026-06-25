'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Shield,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';

import { useToast } from '@/components/shared/toast-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface, Glass } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import type { AuthPage } from '@/features/auth/content/auth-copy';
import { AUTH_FORM_COPY } from '@/features/auth/content/auth-copy';
import { useAdminAuth } from '@/features/auth/hooks/use-admin-auth';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  validateAdminPassword,
  validateAdminSecret,
  validateEmail,
  validateFullName,
  validatePasswordMatch,
  validatePasswordRequired,
  validateUserPassword,
} from '@/features/auth/utils/auth-validation';
import { authContainerVariants, authItemVariants } from './auth-motion';
import { PasswordStrength } from './password-strength';

export type AuthFormMode = AuthPage;

interface AuthFormProps {
  mode: AuthFormMode;
}

interface FieldProps {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  icon?: React.ReactNode;
  labelAction?: React.ReactNode;
  showPasswordToggle?: boolean;
}

function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  error,
  icon,
  labelAction,
  showPasswordToggle,
}: FieldProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPasswordToggle && showPassword ? 'text' : type;

  return (
    <motion.div variants={authItemVariants} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={id}
          className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          {label}
        </Label>
        {labelAction}
      </div>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70">
            {icon}
          </span>
        )}
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'h-12 touch-target px-5 text-[15px]',
            icon && 'pl-11',
            isPassword && showPasswordToggle && 'pr-11',
            error && 'border-destructive/50 focus-visible:ring-destructive/30'
          )}
        />
        {isPassword && showPasswordToggle && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground touch-target-sm"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </motion.div>
  );
}

function FormHeader({
  variant,
  badge,
  title,
  subtitle,
}: {
  variant: 'user' | 'admin';
  badge: string;
  title: string;
  subtitle: string;
}) {
  const Icon = variant === 'admin' ? Shield : Sparkles;

  return (
    <motion.div variants={authItemVariants} className="space-y-3 text-center sm:text-left">
      <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
        <div
          className={cn(
            'relative flex h-6 w-6 items-center justify-center rounded-full',
            variant === 'admin' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary'
          )}
        >
          <Icon className="h-3 w-3" />
        </div>
        <span
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.3em]',
            variant === 'admin' ? 'text-warning' : 'text-primary'
          )}
        >
          {badge}
        </span>
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      <p className="text-sm font-light text-muted-foreground">{subtitle}</p>
    </motion.div>
  );
}

function SubmitButton({
  isLoading,
  loadingLabel,
  label,
  variant,
  id,
}: {
  isLoading: boolean;
  loadingLabel: string;
  label: string;
  variant: 'user' | 'admin';
  id?: string;
}) {
  return (
    <motion.div variants={authItemVariants} className="pt-1">
      <Button
        type="submit"
        id={id}
        disabled={isLoading}
        className="group relative h-12 w-full touch-target overflow-hidden rounded-xl border-0 text-sm font-semibold tracking-wide text-primary-foreground shadow-lg transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] hover:shadow-indigo-500/35 shadow-indigo-500/25"
      >
        <div
          className={
            variant === 'admin'
              ? 'absolute inset-0 animate-gradient-x bg-gradient-to-r from-warning via-amber-500 to-warning bg-[length:200%_auto]'
              : 'absolute inset-0 animate-gradient-x bg-gradient-to-r from-indigo-500 via-primary to-indigo-600 bg-[length:200%_auto] dark:from-indigo-500 dark:via-indigo-400 dark:to-violet-500'
          }
        />
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingLabel}
            </>
          ) : (
            <>
              {label}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </>
          )}
        </span>
      </Button>
    </motion.div>
  );
}

function RoleSwitcher({
  primary,
  secondary,
}: {
  primary: { text: string; href: string; label: string };
  secondary?: { text: string; href: string; label: string };
}) {
  return (
    <>
      <motion.div variants={authItemVariants} className="relative flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-border" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border to-border" />
      </motion.div>
      <motion.div variants={authItemVariants} className="space-y-3">
        <div className="text-center text-[13px] text-muted-foreground">
          {primary.text}{' '}
          <Link
            href={primary.href}
            className="font-semibold text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
          >
            {primary.label}
          </Link>
        </div>
        {secondary && (
          <div className="text-center text-[12px] text-muted-foreground/80">
            {secondary.text}{' '}
            <Link href={secondary.href} className="font-medium transition-colors hover:text-primary">
              {secondary.label}
            </Link>
          </div>
        )}
      </motion.div>
    </>
  );
}

export function AuthForm({ mode }: AuthFormProps) {
  const copy = AUTH_FORM_COPY[mode];
  const searchParams = useSearchParams();
  const toast = useToast();
  const isAdmin = mode.startsWith('admin');

  const userAuth = useAuth();
  const adminAuth = useAdminAuth();

  const isLoggingIn = isAdmin ? adminAuth.isLoggingIn : userAuth.isLoggingIn;
  const isRegistering = isAdmin ? adminAuth.isRegistering : userAuth.isRegistering;

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [adminSecret, setAdminSecret] = React.useState('');
  const [inviteToken, setInviteToken] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  const registeredToastShown = React.useRef(false);
  React.useEffect(() => {
    if (mode !== 'admin-register') return;
    const invite = searchParams.get('invite')?.trim();
    const invitedEmail = searchParams.get('email')?.trim();
    if (invite) {
      setInviteToken(invite);
    }
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [mode, searchParams]);
  React.useEffect(() => {
    if (registeredToastShown.current) return;
    if (mode !== 'login' && mode !== 'admin-login') return;
    if (searchParams.get('registered') !== '1') return;
    registeredToastShown.current = true;
    const message =
      mode === 'admin-login'
        ? 'Sign in to access the admin console.'
        : 'Sign in to access your codebase workspace.';
    toast.info('Account created', message);
  }, [mode, searchParams, toast]);

  const isLogin = mode === 'login' || mode === 'admin-login';
  const isRegister = mode === 'register' || mode === 'admin-register';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string | undefined> = {};

    if (isLogin) {
      nextErrors.email = validateEmail(email);
      nextErrors.password = validatePasswordRequired(password);
    }

    if (isRegister) {
      nextErrors.fullName = validateFullName(fullName);
      nextErrors.email = validateEmail(email);
      if (mode === 'register') {
        nextErrors.password = validateUserPassword(password);
        nextErrors.confirmPassword = validatePasswordMatch(password, confirmPassword);
      } else {
        nextErrors.password = validateAdminPassword(password);
        if (!inviteToken) {
          nextErrors.adminSecret = validateAdminSecret(adminSecret);
        }
      }
    }

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (isLogin) {
      if (isAdmin) {
        adminAuth.login({ email, password });
      } else {
        userAuth.login({ email, password });
      }
      return;
    }

    if (mode === 'register') {
      userAuth.register({ email, password, full_name: fullName.trim() });
      return;
    }

    adminAuth.register({
      email,
      password,
      full_name: fullName.trim(),
      ...(inviteToken
        ? { invite_token: inviteToken }
        : { admin_secret_key: adminSecret }),
    });
  };

  return (
    <Glass
      intensity="high"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-[1.75rem] border border-indigo-200/40 bg-white/80 p-6 shadow-[0_24px_80px_-20px_rgba(99,102,241,0.12),0_8px_24px_-8px_rgba(0,0,0,0.08)] dark:border-white/[0.1] dark:bg-[rgba(22,24,32,0.85)] dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.55)] sm:p-8 lg:p-10"
      role="main"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-100/20 via-transparent to-violet-100/10 dark:from-white/[0.04] dark:via-transparent dark:to-transparent" />
      <motion.div
        variants={authContainerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 space-y-6"
      >
        <FormHeader
          variant={copy.variant}
          badge={copy.badge}
          title={copy.title}
          subtitle={copy.subtitle}
        />


        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {isRegister && (
            <FormField
              id={`${mode}-name`}
              label="Full Name"
              value={fullName}
              onChange={setFullName}
              placeholder="John Doe"
              autoComplete="name"
              required
              error={errors.fullName}
              icon={<UserIcon className="h-4 w-4" />}
            />
          )}

          <FormField
            id={`${mode}-email`}
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder={isAdmin ? 'admin@example.com' : 'name@example.com'}
            autoComplete="email"
            required
            error={errors.email}
            icon={<Mail className="h-4 w-4" />}
          />

          <FormField
            id={`${mode}-password`}
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={isLogin ? '••••••••' : 'Min. 8 characters'}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            error={errors.password}
            icon={<Lock className="h-4 w-4" />}
            showPasswordToggle
            labelAction={
              isLogin ? (
                <span
                  title="Coming soon"
                  className="cursor-default text-[10px] font-medium text-muted-foreground/60"
                >
                  Forgot password — coming soon
                </span>
              ) : undefined
            }
          />

          {mode === 'register' && <PasswordStrength password={password} />}

          {mode === 'register' && (
            <FormField
              id="register-confirm"
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Repeat password"
              autoComplete="new-password"
              required
              error={errors.confirmPassword}
              icon={<Lock className="h-4 w-4" />}
              showPasswordToggle
            />
          )}

          {mode === 'admin-register' && !inviteToken && (
            <FormField
              id="admin-register-secret"
              label="Admin Secret Key"
              type="password"
              value={adminSecret}
              onChange={setAdminSecret}
              placeholder="Enter your admin secret key"
              autoComplete="off"
              required
              error={errors.adminSecret}
              icon={<KeyRound className="h-4 w-4" />}
              showPasswordToggle
            />
          )}

          {mode === 'admin-register' && inviteToken ? (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Admin invite active</p>
              <p>No secret key is required when registering from your invite link.</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Complete the form below with your invited email.</li>
                <li>Sign in at Admin Login after registration.</li>
              </ol>
            </div>
          ) : null}

          {mode === 'admin-register' && !inviteToken && email.trim() ? (
            <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Waiting for invite link from administrator</p>
              <p>
                Open the registration link your administrator sent you, or enter the Admin Secret Key
                below. Contact your administrator if you do not have the link or secret key.
              </p>
            </div>
          ) : null}

          <SubmitButton
            id={mode === 'login' ? 'login-submit' : undefined}
            isLoading={isLogin ? isLoggingIn : isRegistering}
            loadingLabel={copy.submitLoading}
            label={copy.submitLabel}
            variant={copy.variant}
          />
        </form>

        <RoleSwitcher
          primary={copy.primarySwitcher}
          secondary={copy.secondarySwitcher}
        />
      </motion.div>
    </Glass>
  );
}
