import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';

import { usePendingInviteNotifications } from '@/features/notifications/hooks/use-pending-invite-notifications';
import { authService } from '@/features/auth/services/auth-service';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';

jest.mock('@/features/auth/services/auth-service', () => ({
  authService: {
    getPendingInvites: jest.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('usePendingInviteNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
    useNotificationStore.setState({ activeUserId: 'user-1', notifications: [] });
    useAuthStore.setState({
      hydrated: true,
      token: 'token',
      user: {
        id: 'user-1',
        email: 'invitee@example.com',
        role: 'USER',
        full_name: 'Invitee',
        is_active: true,
        token_scopes: [],
      },
    });
    (authService.getPendingInvites as jest.Mock).mockResolvedValue([
      {
        id: 'invite-1',
        kind: 'admin',
        email: 'invitee@example.com',
        expires_at: '2030-01-01T00:00:00.000Z',
        created_at: '2025-01-01T00:00:00.000Z',
        register_path: '/admin/register',
        has_account: true,
      },
    ]);
  });

  it('emits invite notification with registration steps CTA', async () => {
    renderHook(() => usePendingInviteNotifications(), { wrapper });

    await waitFor(() => {
      expect(useNotificationStore.getState().notifications.length).toBeGreaterThan(0);
    });

    const notification = useNotificationStore.getState().notifications[0];
    expect(notification.kind).toBe('invite');
    expect(notification.actionLabel).toBe('Registration steps');
    expect(notification.actionUrl).toBe('/admin/register?email=invitee%40example.com');
    expect(notification.message).toContain('registration link');
    expect(notification.message).not.toContain('invite token');
  });
});
