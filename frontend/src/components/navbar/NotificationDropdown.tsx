"use client";
import { useNotificationStore } from "@/store/notification-store";
import { Bell, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { useState } from "react";

const iconMap = {
  success: <CheckCircle className="h-5 w-5 text-cyan-400" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  info: <Info className="h-5 w-5 text-zinc-400" />,
};

export function NotificationDropdown() {
  const { notifications, markAsRead, clearAll } = useNotificationStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="relative p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border-none focus:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-6 w-6 text-cyan-400" />
        {notifications.some((n) => !n.read) && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-cyan-400" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <button
              className="text-xs text-cyan-400 hover:underline border-none bg-transparent"
              onClick={clearAll}
            >
              Clear All
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-zinc-500 text-sm">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 bg-transparent hover:bg-zinc-900 transition-all ${n.read ? "opacity-60" : ""}`}
                  onClick={() => markAsRead(n.id)}
                  role="button"
                  tabIndex={0}
                >
                  {iconMap[n.type]}
                  <div className="flex-1">
                    <div className="text-sm text-white font-medium">{n.title}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{n.message}</div>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 min-w-fit">
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
