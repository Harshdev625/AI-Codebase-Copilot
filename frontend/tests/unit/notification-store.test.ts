import { useNotificationStore } from '@/store/notification-store';

describe('notification-store', () => {
  beforeEach(() => {
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
});
