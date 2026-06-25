import { useNotificationStore, selectUnreadCount } from '@/store/notification-store';

describe('notification-store', () => {
  beforeEach(() => {
    localStorage.removeItem('tm.notifications.items');
    localStorage.removeItem('tm.notifications.items:user:guest');
    localStorage.removeItem('tm.notifications.items:user:user-a');
    localStorage.removeItem('tm.notifications.items:user:user-b');
    localStorage.removeItem('tm.notifications.dismissed:user:guest');
    localStorage.removeItem('tm.notifications.dismissed:user:user-a');
    localStorage.removeItem('tm.notifications.dismissed:user:user-b');
    useNotificationStore.setState({ activeUserId: null, notifications: [] });
  });

  it('adds a notification', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test',
      message: 'Test message',
      type: 'info',
    });

    const notifs = useNotificationStore.getState().notifications;
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('Test');
    expect(notifs[0].read).toBe(false);
  });

  it('persists action fields and kind', () => {
    useNotificationStore.getState().addNotification({
      title: 'Invite',
      message: 'You have an invite',
      type: 'info',
      kind: 'invite',
      actionLabel: 'Registration steps',
      actionUrl: '/admin/register?email=test%40example.com',
      dismissible: true,
    });

    const notif = useNotificationStore.getState().notifications[0];
    expect(notif.kind).toBe('invite');
    expect(notif.actionLabel).toBe('Registration steps');
    expect(notif.actionUrl).toBe('/admin/register?email=test%40example.com');
    expect(notif.dismissible).toBe(true);
  });

  it('dedupes notifications by dedupeKey', () => {
    useNotificationStore.getState().addNotification({
      title: 'Indexing complete',
      message: 'First',
      type: 'success',
      dedupeKey: 'indexing:job-1:completed',
    });
    useNotificationStore.getState().addNotification({
      title: 'Indexing complete',
      message: 'Updated',
      type: 'success',
      dedupeKey: 'indexing:job-1:completed',
    });

    const notifs = useNotificationStore.getState().notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].message).toBe('Updated');
  });

  it('isolates notifications per user', () => {
    useNotificationStore.getState().hydrateForUser('user-a');
    useNotificationStore.getState().addNotification({
      title: 'User A',
      message: 'Only A',
      type: 'info',
    });

    useNotificationStore.getState().hydrateForUser('user-b');
    expect(useNotificationStore.getState().notifications).toHaveLength(0);

    useNotificationStore.getState().addNotification({
      title: 'User B',
      message: 'Only B',
      type: 'info',
    });
    expect(useNotificationStore.getState().notifications[0].title).toBe('User B');

    useNotificationStore.getState().hydrateForUser('user-a');
    expect(useNotificationStore.getState().notifications[0].title).toBe('User A');
  });

  it('marks as read', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test',
      message: 'Test message',
      type: 'info',
    });

    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markAsRead(id);

    const notifs = useNotificationStore.getState().notifications;
    expect(notifs[0].read).toBe(true);
  });

  it('clears all notifications', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test',
      message: 'Test message',
      type: 'info',
    });

    useNotificationStore.getState().clearAll();
    const notifs = useNotificationStore.getState().notifications;
    expect(notifs.length).toBe(0);
  });

  it('marks all as read and tracks unread count', () => {
    useNotificationStore.getState().addNotification({
      title: 'One',
      message: 'A',
      type: 'info',
    });
    useNotificationStore.getState().addNotification({
      title: 'Two',
      message: 'B',
      type: 'warning',
    });

    expect(selectUnreadCount(useNotificationStore.getState().notifications)).toBe(2);
    useNotificationStore.getState().markAllAsRead();
    expect(selectUnreadCount(useNotificationStore.getState().notifications)).toBe(0);
  });

  it('removes a single notification', () => {
    useNotificationStore.getState().addNotification({
      title: 'Remove me',
      message: 'Bye',
      type: 'error',
    });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('does not re-add a dismissed dedupeKey', () => {
    useNotificationStore.getState().addNotification({
      title: 'Indexing complete',
      message: 'Done',
      type: 'success',
      dedupeKey: 'indexing:job-1:completed',
    });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().removeNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);

    useNotificationStore.getState().addNotification({
      title: 'Indexing complete',
      message: 'Done again',
      type: 'success',
      dedupeKey: 'indexing:job-1:completed',
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it('clearAll prevents dismissed notifications from returning', () => {
    useNotificationStore.getState().addNotification({
      title: 'One',
      message: 'A',
      type: 'info',
      dedupeKey: 'patch:1:APPLIED',
    });
    useNotificationStore.getState().clearAll();
    useNotificationStore.getState().addNotification({
      title: 'One',
      message: 'A',
      type: 'info',
      dedupeKey: 'patch:1:APPLIED',
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});
