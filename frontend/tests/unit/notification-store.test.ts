import { useNotificationStore, selectUnreadCount } from '@/store/notification-store';

describe('notification-store', () => {
  beforeEach(() => {
    localStorage.removeItem('tm.notifications.items');
    useNotificationStore.setState({ notifications: [] });
  });

  it('adds a notification', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test',
      message: 'Test message',
      type: 'info'
    });

    const notifs = useNotificationStore.getState().notifications;
    expect(notifs.length).toBe(1);
    expect(notifs[0].title).toBe('Test');
    expect(notifs[0].read).toBe(false);
  });

  it('marks as read', () => {
    useNotificationStore.getState().addNotification({
      title: 'Test',
      message: 'Test message',
      type: 'info'
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
      type: 'info'
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
});
