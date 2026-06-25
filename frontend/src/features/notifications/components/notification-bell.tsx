'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  Bell,
  CheckCheck,
  FileDiff,
  FolderGit2,
  Mail,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, formatDate } from '@/lib/utils';
import type { NotificationKind } from '@/features/notifications/notification-copy';
import type { Notification } from '@/store/notification-store';
import {
  useNotificationStore,
  useUnreadNotificationCount,
} from '@/store/notification-store';

function typeAccent(type: string): string {
  switch (type) {
    case 'success':
      return 'border-l-success';
    case 'warning':
      return 'border-l-warning';
    case 'error':
      return 'border-l-destructive';
    default:
      return 'border-l-primary';
  }
}

function kindIcon(kind?: NotificationKind): React.ReactNode {
  const className = 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground';
  switch (kind) {
    case 'invite':
      return <Mail className={className} />;
    case 'indexing':
      return <Activity className={className} />;
    case 'repository':
      return <FolderGit2 className={className} />;
    case 'patch':
      return <FileDiff className={className} />;
    case 'studio':
      return <Sparkles className={className} />;
    default:
      return <Bell className={className} />;
  }
}

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const hasAction = Boolean(notification.actionUrl && notification.actionLabel);

  return (
    <div
      data-testid={`notification-item-${notification.id}`}
      className={cn(
        'border-b border-border/20 border-l-2 px-4 py-3 transition-colors',
        typeAccent(notification.type),
        !notification.read && 'bg-muted/20',
      )}
    >
      <div className="flex items-start gap-2">
        {kindIcon(notification.kind)}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{notification.title}</p>
            <div className="flex shrink-0 items-center gap-0.5">
              {!notification.read ? (
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" aria-hidden />
              ) : null}
              {notification.dismissible !== false ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  aria-label="Delete notification"
                  title="Delete"
                  onClick={() => onDismiss(notification.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            {formatDate(new Date(notification.timestamp).toISOString())}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {hasAction ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-xs"
                asChild
                onClick={() => onMarkRead(notification.id)}
              >
                <Link href={notification.actionUrl!}>{notification.actionLabel}</Link>
              </Button>
            ) : null}
            {!notification.read ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => onMarkRead(notification.id)}
              >
                Mark read
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const notifications = useNotificationStore((s) => s.notifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const unreadCount = useUnreadNotificationCount();

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
        data-testid="notification-bell"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            data-testid="notification-unread-badge"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            <div className="flex items-center gap-1">
              {notifications.length > 0 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Mark all as read"
                    onClick={() => markAllAsRead()}
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Delete all notifications"
                    title="Delete all"
                    onClick={() => clearAll()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Activity from indexing, repositories, and invites will appear here.
              </p>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markAsRead}
                  onDismiss={removeNotification}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
