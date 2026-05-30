/**
 * Test utilities for React component testing.
 * 
 * Provides a properly configured QueryClientProvider wrapper and
 * render helper that wraps components with all required providers.
 */
import React, { type ReactElement, type ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Create a fresh QueryClient configured for testing.
 * - No retries (fail fast)
 * - No refetch on window focus
 * - GC time = 0 (clean up immediately)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

import { ToastProvider } from "@/components/shared/toast-provider";

/**
 * Wrapper that provides all required context providers for tests.
 */
function TestProviders({ children }: { children: ReactNode }) {
  const [queryClient] = React.useState(() => createTestQueryClient());
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(ToastProvider, null, children)
  );
}

/**
 * Custom render function that wraps the component in TestProviders.
 * Use this instead of `render` from @testing-library/react.
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

export { TestProviders };
