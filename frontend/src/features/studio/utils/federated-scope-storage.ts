const FEDERATED_SCOPE_KEY = 'tm.studio.federatedRepoIds';

const isBrowser = () => typeof window !== 'undefined';

function scopedKey(userId: string): string {
  return `${FEDERATED_SCOPE_KEY}.${userId}`;
}

export function readFederatedRepoIds(userId: string | null | undefined): string[] {
  if (!isBrowser() || !userId) return [];
  const raw = window.localStorage.getItem(scopedKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFederatedRepoIds(userId: string | null | undefined, ids: string[]): void {
  if (!isBrowser() || !userId) return;
  window.localStorage.setItem(scopedKey(userId), JSON.stringify(ids));
}
