import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BrainCircuit,
  Clock3,
  Code2,
  GitBranchPlus,
  MessageSquare,
  Radar,
  Search,
  Shield,
  Users,
} from 'lucide-react';

export type AuthPage = 'login' | 'register' | 'admin-login' | 'admin-register';

export interface AuthFormCopy {
  badge: string;
  title: string;
  subtitle: string;
  submitLabel: string;
  submitLoading: string;
  variant: 'user' | 'admin';
  primarySwitcher: { text: string; href: string; label: string };
  secondarySwitcher?: { text: string; href: string; label: string };
}

export interface AuthFeatureItem {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind grid column span classes for bento layout */
  className?: string;
  /** Hide below this breakpoint (drawer / narrow panels) */
  hideBelow?: 'xl' | '2xl';
  iconClass?: string;
  accent?: string;
}

export interface AuthMarketingCopy {
  badge: string;
  headline: string;
  headlineAccent: string;
  description: string;
  features: AuthFeatureItem[];
}

export const AUTH_FOOTER = {
  tagline: 'Local-first codebase intelligence',
  copyright: '© 2026 AI Codebase Copilot',
  stack: 'FastAPI · LangGraph · Qdrant',
} as const;

const USER_FEATURES: AuthFeatureItem[] = [
  {
    icon: Radar,
    title: 'Incremental Indexing',
    description:
      'Re-index only changed files via git diff detection. Full and incremental modes with job tracking.',
    className: 'md:col-span-7',
    iconClass: 'text-indigo-400',
    accent: 'from-indigo-500/12 to-transparent',
  },
  {
    icon: BrainCircuit,
    title: 'AI Context Management',
    description:
      'Pin files, scope folders, and monitor token budgets across your repositories.',
    className: 'md:col-span-5',
    iconClass: 'text-violet-400',
    accent: 'from-violet-500/12 to-transparent',
  },
  {
    icon: GitBranchPlus,
    title: 'Cross-repo context',
    description:
      'Scope files and folders from your indexed repositories into chat sessions for grounded answers.',
    className: 'md:col-span-5',
    iconClass: 'text-teal-400',
    accent: 'from-teal-500/12 to-transparent',
  },
  {
    icon: Clock3,
    title: 'Snapshot Time-Travel',
    description:
      'Browse historical commits, diff snapshots, and inspect code at any prior state.',
    className: 'md:col-span-7',
    iconClass: 'text-cyan-400',
    accent: 'from-cyan-500/10 to-transparent',
  },
  {
    icon: Search,
    title: 'Hybrid Semantic Search',
    description:
      'Combine vector and keyword retrieval to surface the right symbols and snippets.',
    className: 'md:col-span-6',
    hideBelow: 'xl',
    iconClass: 'text-sky-400',
    accent: 'from-sky-500/10 to-transparent',
  },
  {
    icon: Code2,
    title: 'ACT Patch Review',
    description:
      'Review AI-generated patches with diff views, validation, and apply workflow in ACT mode.',
    className: 'md:col-span-6',
    hideBelow: 'xl',
    iconClass: 'text-fuchsia-400',
    accent: 'from-fuchsia-500/10 to-transparent',
  },
];

const ADMIN_FEATURES: AuthFeatureItem[] = [
  {
    icon: BarChart3,
    title: 'Platform Metrics',
    description: 'Monitor indexing jobs, retrieval health, and system-wide activity.',
    className: 'md:col-span-6',
    iconClass: 'text-amber-400',
    accent: 'from-amber-500/12 to-transparent',
  },
  {
    icon: Users,
    title: 'User Oversight',
    description: 'Manage developer accounts, roles, and access across the deployment.',
    className: 'md:col-span-6',
    iconClass: 'text-indigo-400',
    accent: 'from-indigo-500/12 to-transparent',
  },
  {
    icon: Shield,
    title: 'Secure Operations',
    description: 'Role-gated admin console with JWT-protected routes and audit visibility.',
    className: 'md:col-span-12',
    iconClass: 'text-violet-400',
    accent: 'from-violet-500/10 to-transparent',
  },
  {
    icon: MessageSquare,
    title: 'Repository Governance',
    description: 'Oversee attached projects, indexing status, and platform configuration.',
    className: 'md:col-span-6',
    hideBelow: 'xl',
    iconClass: 'text-teal-400',
    accent: 'from-teal-500/10 to-transparent',
  },
  {
    icon: Radar,
    title: 'Indexing Pipeline',
    description: 'Track background jobs, snapshot retention, and worker health at scale.',
    className: 'md:col-span-6',
    hideBelow: 'xl',
    iconClass: 'text-cyan-400',
    accent: 'from-cyan-500/10 to-transparent',
  },
];

export const AUTH_MARKETING: Record<AuthPage, AuthMarketingCopy> = {
  login: {
    badge: 'Code Intelligence Platform',
    headline: 'Sign in to your',
    headlineAccent: 'codebase workspace.',
    description:
      'Index, inspect, and interrogate your repositories without context switching. A focused, local-first environment for professional software development.',
    features: USER_FEATURES,
  },
  register: {
    badge: 'Developer Onboarding',
    headline: 'Register your',
    headlineAccent: 'first project.',
    description:
      'Create an account and attach repositories for semantic search, contextual chat, and incremental indexing.',
    features: USER_FEATURES,
  },
  'admin-login': {
    badge: 'Platform Administration',
    headline: 'Admin',
    headlineAccent: 'control room.',
    description:
      'Secure access to system health, user management, and repository oversight for your deployment.',
    features: ADMIN_FEATURES,
  },
  'admin-register': {
    badge: 'Admin Provisioning',
    headline: 'Create',
    headlineAccent: 'administrator access.',
    description:
      'Register an admin account with your deployment secret key. Restricted to authorized operators.',
    features: ADMIN_FEATURES,
  },
};

export const AUTH_FORM_COPY: Record<AuthPage, AuthFormCopy> = {
  login: {
    badge: 'Developer Sign In',
    title: 'Welcome back',
    subtitle: 'Authenticate to access your indexed repositories and engineering workspace.',
    submitLabel: 'Sign In to Codebase',
    submitLoading: 'Authenticating...',
    variant: 'user',
    primarySwitcher: { text: 'New to the platform?', href: '/register', label: 'Create an account' },
    secondarySwitcher: { text: 'Admin access?', href: '/admin/login', label: 'Sign in as admin' },
  },
  register: {
    badge: 'Create Account',
    title: 'Join the platform',
    subtitle: 'Register to index repositories and begin codebase interrogation.',
    submitLabel: 'Create Developer Account',
    submitLoading: 'Creating account...',
    variant: 'user',
    primarySwitcher: { text: 'Already have an account?', href: '/login', label: 'Sign in' },
  },
  'admin-login': {
    badge: 'Admin Sign In',
    title: 'Secure control room',
    subtitle: 'Access system health, repositories, and user management.',
    submitLabel: 'Enter Admin Console',
    submitLoading: 'Authenticating...',
    variant: 'admin',
    primarySwitcher: { text: 'Need a developer account?', href: '/login', label: 'User sign in' },
    secondarySwitcher: { text: 'Register admin?', href: '/admin/register', label: 'Create admin account' },
  },
  'admin-register': {
    badge: 'Admin Registration',
    title: 'Create admin account',
    subtitle: 'Requires a valid admin registration secret from your deployment.',
    submitLabel: 'Create Admin Account',
    submitLoading: 'Creating admin...',
    variant: 'admin',
    primarySwitcher: { text: 'Already registered?', href: '/admin/login', label: 'Admin sign in' },
    secondarySwitcher: { text: 'Developer account?', href: '/register', label: 'User registration' },
  },
};

export function pathnameToAuthPage(pathname: string): AuthPage {
  if (pathname.startsWith('/admin/register')) return 'admin-register';
  if (pathname.startsWith('/admin/login')) return 'admin-login';
  if (pathname.startsWith('/register')) return 'register';
  return 'login';
}
