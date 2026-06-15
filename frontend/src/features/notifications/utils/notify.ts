import { useNotificationStore } from '@/store/notification-store';

type NotificationInput = Parameters<ReturnType<typeof useNotificationStore.getState>['addNotification']>[0];

export function pushNotification(input: NotificationInput): void {
  useNotificationStore.getState().addNotification(input);
}

export function notifySuccess(title: string, message: string): void {
  pushNotification({ title, message, type: 'success' });
}

export function notifyInfo(title: string, message: string): void {
  pushNotification({ title, message, type: 'info' });
}

export function notifyWarning(title: string, message: string): void {
  pushNotification({ title, message, type: 'warning' });
}

export function notifyError(title: string, message: string): void {
  pushNotification({ title, message, type: 'error' });
}
