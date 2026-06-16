import type { NotificationInput } from '@/store/notification-store';
import { useNotificationStore } from '@/store/notification-store';
import type { NotificationKind } from '@/features/notifications/notification-copy';

export type ActionNotificationInput = NotificationInput & {
  kind?: NotificationKind;
  actionLabel?: string;
  actionUrl?: string;
  dedupeKey?: string;
};

export function pushNotification(input: NotificationInput): void {
  useNotificationStore.getState().addNotification(input);
}

export function pushActionNotification(input: ActionNotificationInput): void {
  useNotificationStore.getState().addNotification({
    dismissible: true,
    ...input,
  });
}

export function notifySuccess(title: string, message: string, extras?: Partial<ActionNotificationInput>): void {
  pushActionNotification({ title, message, type: 'success', kind: 'general', ...extras });
}

export function notifyInfo(title: string, message: string, extras?: Partial<ActionNotificationInput>): void {
  pushActionNotification({ title, message, type: 'info', kind: 'general', ...extras });
}

export function notifyWarning(title: string, message: string, extras?: Partial<ActionNotificationInput>): void {
  pushActionNotification({ title, message, type: 'warning', kind: 'general', ...extras });
}

export function notifyError(title: string, message: string, extras?: Partial<ActionNotificationInput>): void {
  pushActionNotification({ title, message, type: 'error', kind: 'general', ...extras });
}
