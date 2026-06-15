import type { LucideIcon } from 'lucide-react';
import { FolderGit2, LayoutDashboard, MessageSquare, Search } from 'lucide-react';

export interface OnboardingStep {
  title: string;
  description: string;
  icon: LucideIcon;
  ctaLabel?: string;
  ctaHref?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to AI Codebase Copilot',
    description:
      'Connect a Git repository or local folder to start indexing your codebase. The dashboard is your home for repository health and indexing jobs.',
    icon: FolderGit2,
    ctaLabel: 'Go to Dashboard',
    ctaHref: '/dashboard',
  },
  {
    title: 'Index your repositories',
    description:
      'Use Start Indexing or Update Index on the dashboard to chunk and embed your code. Progress appears in real time while Ollama and Qdrant process your files.',
    icon: LayoutDashboard,
    ctaLabel: 'View repositories',
    ctaHref: '/dashboard',
  },
  {
    title: 'Open Studio for AI chat',
    description:
      'Studio combines an editor, file explorer, and AI chat grounded in your indexed code. Ask questions, explore architecture, and review patches.',
    icon: MessageSquare,
    ctaLabel: 'Open Studio',
    ctaHref: '/studio',
  },
  {
    title: 'Search across repositories',
    description:
      'In Studio chat, use Federated Scope to query multiple repositories at once. Press Ctrl+K (Cmd+K on Mac) anywhere to open the command palette.',
    icon: Search,
  },
];

export const ONBOARDING_TOTAL_STEPS = ONBOARDING_STEPS.length;
