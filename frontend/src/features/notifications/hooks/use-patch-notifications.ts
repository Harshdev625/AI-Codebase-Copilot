'use client';

import * as React from 'react';

import {
  patchAppliedTitle,
  patchApprovedTitle,
  patchFailedTitle,
  patchMessage,
  patchRejectedTitle,
} from '@/features/notifications/notification-copy';
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from '@/features/notifications/utils/notify';

type PatchLike = {
  id: string;
  status?: string;
  message?: string;
};

const TERMINAL_PATCH_STATUSES = new Set(['APPLIED', 'FAILED', 'REJECTED', 'REVIEW']);

function patchActionUrl(repositoryId: string, patchId: string): string {
  const params = new URLSearchParams({
    repository_id: repositoryId,
    panel: 'patches',
    patch_id: patchId,
  });
  return `/studio?${params.toString()}`;
}

function notifyPatchTerminal(repositoryId: string, patch: PatchLike): void {
  const status = String(patch.status ?? '').toUpperCase();
  if (!TERMINAL_PATCH_STATUSES.has(status)) return;

  const dedupeKey = `patch:${patch.id}:${status}`;
  const actionUrl = patchActionUrl(repositoryId, patch.id);
  const detail = patch.message ? String(patch.message) : undefined;

  if (status === 'APPLIED') {
    notifySuccess(patchAppliedTitle(), patchMessage(patch.id, detail ?? 'Successfully applied.'), {
      kind: 'patch',
      actionLabel: 'Review patch',
      actionUrl,
      dedupeKey,
    });
    return;
  }

  if (status === 'FAILED') {
    notifyError(patchFailedTitle(), patchMessage(patch.id, detail ?? 'Apply step failed.'), {
      kind: 'patch',
      actionLabel: 'Review patch',
      actionUrl,
      dedupeKey,
    });
    return;
  }

  if (status === 'REJECTED') {
    notifyWarning(patchRejectedTitle(), patchMessage(patch.id, detail ?? 'Validation failed.'), {
      kind: 'patch',
      actionLabel: 'Review patch',
      actionUrl,
      dedupeKey,
    });
    return;
  }

  if (status === 'REVIEW') {
    notifyInfo(patchApprovedTitle(), patchMessage(patch.id, detail ?? 'Ready to apply.'), {
      kind: 'patch',
      actionLabel: 'Review patch',
      actionUrl,
      dedupeKey,
    });
  }
}

/**
 * Emits bell notifications when patch statuses reach terminal states.
 */
export function usePatchNotifications(repositoryId?: string, patches?: PatchLike[]): void {
  const prevStatusesRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    prevStatusesRef.current = new Map();
  }, [repositoryId]);

  React.useEffect(() => {
    if (!repositoryId || !patches?.length) return;

    for (const patch of patches) {
      const status = String(patch.status ?? '').toUpperCase();
      const prev = prevStatusesRef.current.get(patch.id);
      if (prev === status) continue;
      prevStatusesRef.current.set(patch.id, status);

      if (!prev) continue;
      notifyPatchTerminal(repositoryId, patch);
    }
  }, [repositoryId, patches]);
}

export { notifyPatchTerminal, patchActionUrl };
