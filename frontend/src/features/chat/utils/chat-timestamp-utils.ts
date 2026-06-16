/** Format message timestamp with date and time for chat bubbles. */
export function formatChatTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (isToday) {
      return `Today · ${time}`;
    }
    const datePart = date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    return `${datePart} · ${time}`;
  } catch {
    return dateStr;
  }
}

/** Format session header date (full date + time). */
export function formatSessionTimestamp(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}
