"use client";

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { ToastProvider, useToast } from '@/components/shared/toast-provider';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { useLogout } from '@/features/auth/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { globalEvents, EVENTS } from '@/lib/events';

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
        toast.error("Session Expired", "Please log in again to continue.");
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
            {children}
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
