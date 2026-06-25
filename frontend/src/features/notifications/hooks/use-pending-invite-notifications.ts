'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { authService } from '@/features/auth/services/auth-service';
import {
  invitePendingMessage,
  invitePendingTitle,
  inviteRegistrationStepsLabel,
} from '@/features/notifications/notification-copy';
import { pushActionNotification } from '@/features/notifications/utils/notify';
import { useAuthStore } from '@/store/auth-store';

const SEEN_INVITES_KEY_PREFIX = 'tm.notifications.seen-invites:user:';

function readSeenInviteIds(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(`${SEEN_INVITES_KEY_PREFIX}${userId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSeenInviteIds(userId: string, ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${SEEN_INVITES_KEY_PREFIX}${userId}`,
    JSON.stringify([...ids]),
  );
}

/**
 * Surfaces pending admin invites in the notification bell after login.
 */
export function usePendingInviteNotifications(): void {
  const hydrated = useAuthStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.user?.id);
  const userEmail = useAuthStore((s) => s.user?.email);
  const role = useAuthStore((s) => s.user?.role);
  const token = useAuthStore((s) => s.token);

  const enabled = hydrated && Boolean(userId && token && role !== 'ADMIN');

  const query = useQuery({
    queryKey: ['auth', 'pending-invites', userId],
    queryFn: () => authService.getPendingInvites(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  React.useEffect(() => {
    if (!enabled || !userId || !query.data?.length) return;

    const seen = readSeenInviteIds(userId);
    let changed = false;

    for (const invite of query.data) {
      const dedupeKey = `invite:${invite.id}`;
      if (seen.has(invite.id)) continue;

      const email = invite.email || userEmail || 'your email';
      const expires = invite.expires_at
        ? new Date(invite.expires_at).toLocaleString()
        : 'soon';
      const registerEmail = encodeURIComponent(email);

      pushActionNotification({
        title: invitePendingTitle(),
        message: invitePendingMessage(email, expires),
        type: 'info',
        kind: 'invite',
        actionLabel: inviteRegistrationStepsLabel(),
        actionUrl: `/admin/register?email=${registerEmail}`,
        dedupeKey: `invite:${invite.id}`,
        dismissible: true,
      });

      seen.add(invite.id);
      changed = true;
    }

    if (changed) {
      writeSeenInviteIds(userId, seen);
    }
  }, [enabled, userId, userEmail, query.data]);
}
