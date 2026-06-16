import { create } from 'zustand';
import { getStoredUser } from '@/lib/auth';
import type { NotificationKind } from '@/features/notifications/notification-copy';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  kind?: NotificationKind;
  actionLabel?: string;
  actionUrl?: string;
  dedupeKey?: string;
  dismissible?: boolean;
  icon?: React.ReactNode;
  timestamp: number;
  read?: boolean;
};

export type NotificationInput = Omit<Notification, 'id' | 'timestamp' | 'read'>;

interface NotificationStore {
  notifications: Notification[];
  addNotification: (n: NotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 50;
const LEGACY_STORAGE_KEY = 'tm.notifications.items';
const STORAGE_KEY_PREFIX = 'tm.notifications.items:user:';

const isBrowser = () => typeof window !== 'undefined';

function storageKeyForUser(userId: string | null): string {
  return `${STORAGE_KEY_PREFIX}${userId ?? 'guest'}`;
}

const readStoredNotifications = (userId: string | null): Notification[] => {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(storageKeyForUser(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
};

const writeStoredNotifications = (userId: string | null, notifications: Notification[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(storageKeyForUser(userId), JSON.stringify(notifications));
};

export const selectUnreadCount = (notifications: Notification[]) =>
  notifications.filter((n) => !n.read).length;

interface NotificationStoreInternal extends NotificationStore {
  activeUserId: string | null;
  hydrateForUser: (userId: string | null) => void;
}

function migrateLegacyIfNeeded(userId: string | null): void {
  if (!isBrowser()) return;
  const nextKey = storageKeyForUser(userId);
  const hasNext = window.localStorage.getItem(nextKey);
  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!hasNext && legacy) {
    window.localStorage.setItem(nextKey, legacy);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export const useNotificationStore = create<NotificationStoreInternal>((set, get) => {
  const initialUserId = getStoredUser()?.id ?? null;
  migrateLegacyIfNeeded(initialUserId);
  return {
    activeUserId: initialUserId,
    notifications: readStoredNotifications(initialUserId),

    hydrateForUser: (userId) => {
      migrateLegacyIfNeeded(userId);
      set({
        activeUserId: userId,
        notifications: readStoredNotifications(userId),
      });
    },

    addNotification: (n) =>
      set((state) => {
        if (n.dedupeKey) {
          const existing = state.notifications.find((item) => item.dedupeKey === n.dedupeKey);
          if (existing) {
            const updated = state.notifications.map((item) =>
              item.dedupeKey === n.dedupeKey
                ? {
                    ...item,
                    ...n,
                    id: item.id,
                    timestamp: Date.now(),
                    read: false,
                  }
                : item,
            );
            writeStoredNotifications(get().activeUserId, updated);
            return { notifications: updated };
          }
        }

        const next: Notification[] = [
          {
            ...n,
            id: Math.random().toString(36).slice(2),
            timestamp: Date.now(),
            read: false,
            dismissible: n.dismissible ?? true,
          },
          ...state.notifications,
        ].slice(0, MAX_NOTIFICATIONS);
        writeStoredNotifications(get().activeUserId, next);
        return { notifications: next };
      }),

    markAsRead: (id) =>
      set((state) => {
        const next = state.notifications.map((notif) =>
          notif.id === id ? { ...notif, read: true } : notif,
        );
        writeStoredNotifications(get().activeUserId, next);
        return { notifications: next };
      }),

    markAllAsRead: () =>
      set((state) => {
        const next = state.notifications.map((notif) => ({ ...notif, read: true }));
        writeStoredNotifications(get().activeUserId, next);
        return { notifications: next };
      }),

    removeNotification: (id) =>
      set((state) => {
        const next = state.notifications.filter((notif) => notif.id !== id);
        writeStoredNotifications(get().activeUserId, next);
        return { notifications: next };
      }),

    clearAll: () => {
      writeStoredNotifications(get().activeUserId, []);
      set({ notifications: [] });
    },
  };
});

export function useUnreadNotificationCount(): number {
  return useNotificationStore((state) => selectUnreadCount(state.notifications));
}
