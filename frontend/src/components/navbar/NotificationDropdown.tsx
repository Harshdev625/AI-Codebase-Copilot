"use client";
import { useNotificationStore } from "@/store/notification-store";
import { Bell, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { useState } from "react";

const iconMap = {
  success: <CheckCircle className="h-5 w-5 text-success" />,
  error: <XCircle className="h-5 w-5 text-error" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning" />,
  info: <Info className="h-5 w-5 text-muted-foreground" />,
};

export function NotificationDropdown() {
  const { notifications, markAsRead, clearAll } = useNotificationStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-full bg-card/80 hover:bg-card border border-border/50 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-primary" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card border border-border/60 rounded-2xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            <button
              className="text-xs text-primary hover:underline border-none bg-transparent"
              onClick={clearAll}
            >
              Clear All
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-border/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 bg-transparent hover:bg-accent/60 transition-all ${n.read ? "opacity-60" : ""}`}
                  onClick={() => markAsRead(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  {iconMap[n.type]}
                  <div className="flex-1">
                    <div className="text-sm text-foreground font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 min-w-fit">
                    {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
