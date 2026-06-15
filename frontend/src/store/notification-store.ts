import { create } from 'zustand';

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  timestamp: number;
  read?: boolean;
};

type NotificationInput = Omit<Notification, 'id' | 'timestamp' | 'read'>;

interface NotificationStore {
  notifications: Notification[];
  addNotification: (n: NotificationInput) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const MAX_NOTIFICATIONS = 50;
const STORAGE_KEY = 'tm.notifications.items';

const isBrowser = () => typeof window !== 'undefined';

const readStoredNotifications = (): Notification[] => {
  if (!isBrowser()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
};

const writeStoredNotifications = (notifications: Notification[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
};

export const selectUnreadCount = (notifications: Notification[]) =>
  notifications.filter((n) => !n.read).length;

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: readStoredNotifications(),

  addNotification: (n) =>
    set((state) => {
      const next: Notification[] = [
        {
          ...n,
          id: Math.random().toString(36).slice(2),
          timestamp: Date.now(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, MAX_NOTIFICATIONS);
      writeStoredNotifications(next);
      return { notifications: next };
    }),

  markAsRead: (id) =>
    set((state) => {
      const next = state.notifications.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif,
      );
      writeStoredNotifications(next);
      return { notifications: next };
    }),

  markAllAsRead: () =>
    set((state) => {
      const next = state.notifications.map((notif) => ({ ...notif, read: true }));
      writeStoredNotifications(next);
      return { notifications: next };
    }),

  removeNotification: (id) =>
    set((state) => {
      const next = state.notifications.filter((notif) => notif.id !== id);
      writeStoredNotifications(next);
      return { notifications: next };
    }),

  clearAll: () => {
    writeStoredNotifications([]);
    set({ notifications: [] });
  },
}));

export function useUnreadNotificationCount(): number {
  return useNotificationStore((state) => selectUnreadCount(state.notifications));
}
