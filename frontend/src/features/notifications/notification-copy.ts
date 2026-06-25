export type NotificationKind =
  | 'invite'
  | 'indexing'
  | 'repository'
  | 'patch'
  | 'auth'
  | 'studio'
  | 'general';

export function invitePendingTitle(): string {
  return 'Admin invitation';
}

export function invitePendingMessage(email: string, expiresAt: string): string {
  return (
    `You've been invited to join as an administrator for ${email}. ` +
    `Admin access uses a separate admin account — sign out, open the registration link your administrator sent you, ` +
    `then sign in at Admin Login. If you don't have the link, contact your administrator for the invite URL or secret key. ` +
    `Invite expires ${expiresAt}.`
  );
}

export function inviteRegistrationStepsLabel(): string {
  return 'Registration steps';
}

export function indexingCompleteTitle(): string {
  return 'Indexing complete';
}

export function indexingFailedTitle(): string {
  return 'Indexing failed';
}

export function indexingStartedTitle(): string {
  return 'Indexing started';
}

export function indexingMessage(detail: string): string {
  return detail.trim() || 'Repository indexing update.';
}

export function patchAppliedTitle(): string {
  return 'Patch applied';
}

export function patchFailedTitle(): string {
  return 'Patch failed';
}

export function patchRejectedTitle(): string {
  return 'Patch rejected';
}

export function patchApprovedTitle(): string {
  return 'Patch ready to apply';
}

export function patchMessage(patchId: string, detail?: string): string {
  const short = patchId.slice(0, 8);
  return detail?.trim() ? `${detail} (patch ${short})` : `Patch ${short} status updated.`;
}

export function repositoryAddedTitle(): string {
  return 'Repository added';
}

export function repositoryDeletedTitle(): string {
  return 'Repository removed';
}

export function repositoryMessage(repoLabel: string, detail: string): string {
  return `${repoLabel}: ${detail}`;
}

export function sessionExpiredTitle(): string {
  return 'Session expired';
}

export function sessionExpiredMessage(): string {
  return 'Please sign in again to continue.';
}

export function partialRetrievalTitle(): string {
  return 'Partial retrieval';
}
