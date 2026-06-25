import {
  indexingCompleteTitle,
  indexingFailedTitle,
  indexingMessage,
} from '@/features/notifications/notification-copy';
import { notifyError, notifySuccess } from '@/features/notifications/utils/notify';
import { isTerminalIndexingStatus } from '@/features/repositories/utils/indexing-cache';

type IndexingJobLike = {
  id?: string;
  status?: string;
  message?: string;
};

export function notifyIndexingTerminal(job: IndexingJobLike, fallbackMessage?: string): void {
  const status = String(job.status ?? '').toLowerCase();
  if (!isTerminalIndexingStatus(status)) return;

  const message = indexingMessage(String(job.message ?? fallbackMessage ?? ''));
  const dedupeKey = job.id ? `indexing:${job.id}:${status}` : undefined;

  if (status === 'failed' || status === 'error') {
    notifyError(indexingFailedTitle(), message, {
      kind: 'indexing',
      dedupeKey,
    });
    return;
  }

  if (status === 'completed' || status === 'complete' || status === 'success') {
    notifySuccess(indexingCompleteTitle(), message, {
      kind: 'indexing',
      dedupeKey,
    });
  }
}
