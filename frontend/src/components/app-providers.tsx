"use client";

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { ToastProvider, useToast } from '@/components/shared/toast-provider';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { useOnboardingStore } from '@/store/onboarding-store';
import { globalEvents, EVENTS } from '@/lib/events';
import {
  sessionExpiredMessage,
  sessionExpiredTitle,
} from '@/features/notifications/notification-copy';
import { notifyError } from '@/features/notifications/utils/notify';
import { useIndexingNotifications } from '@/features/notifications/hooks/use-indexing-notifications';
import { usePatchNotifications } from '@/features/notifications/hooks/use-patch-notifications';
import { usePendingInviteNotifications } from '@/features/notifications/hooks/use-pending-invite-notifications';
import { usePatches } from '@/features/repositories/hooks/use-repositories';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { useNotificationStore } from '@/store/notification-store';

function OnboardingInitializer() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const userId = useAuthStore((state) => state.user?.id);
  const userRole = useAuthStore((state) => state.user?.role);
  const initializeForUser = useOnboardingStore((state) => state.initializeForUser);

  React.useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (userRole === 'ADMIN') {
      return;
    }
    initializeForUser(userId ?? null);
  }, [hydrated, userId, userRole, initializeForUser]);

  return null;
}

function NotificationInitializer() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const userId = useAuthStore((state) => state.user?.id);
  const selectedRepositoryId = useStudioStore((state) => state.selectedRepositoryId);
  const patchesQuery = usePatches(selectedRepositoryId ?? '');
  const patches = selectedRepositoryId ? (patchesQuery.data ?? []) : [];

  React.useEffect(() => {
    if (!hydrated) return;
    useNotificationStore.getState().hydrateForUser(userId ?? null);
  }, [hydrated, userId]);

  usePendingInviteNotifications();
  useIndexingNotifications();
  useIndexingNotifications(selectedRepositoryId ?? undefined);
  usePatchNotifications(selectedRepositoryId ?? undefined, patches);

  return null;
}

function AuthEventHandler() {
  const pathname = usePathname();
  const logout = useLogout();
  const toast = useToast();

  React.useEffect(() => {
    const unsubscribe = globalEvents.on(EVENTS.UNAUTHORIZED, () => {
      const onAuthPage =
        pathname.startsWith('/login') ||
        pathname.startsWith('/register') ||
        pathname.startsWith('/admin/login') ||
        pathname.startsWith('/admin/register');

      const isAdminArea = pathname.startsWith('/admin');
      logout(isAdminArea ? 'admin' : 'user');

      if (!onAuthPage) {
        toast.error(sessionExpiredTitle(), sessionExpiredMessage());
        notifyError(sessionExpiredTitle(), sessionExpiredMessage(), {
          kind: 'auth',
          dedupeKey: 'auth:session-expired',
        });
      }
    });
    return unsubscribe;
  }, [pathname, logout, toast]);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error: any) => {
              // Don't retry auth errors or 404s
              if (error?.status === 401 || error?.status === 404) return false;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  React.useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthEventHandler />
            <OnboardingInitializer />
            <NotificationInitializer />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
