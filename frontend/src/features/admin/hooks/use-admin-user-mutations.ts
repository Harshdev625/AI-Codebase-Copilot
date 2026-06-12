import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/shared/toast-provider';
import { toApiError } from '@/core/api/errors';
import { adminKeys } from './use-admin-dashboard';
import { adminService } from '../services/admin-service';

export function useAdminUserMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin'] });

  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'USER' | 'ADMIN' }) =>
      adminService.updateUserRole(userId, role),
    onSuccess: () => {
      invalidate();
      toast.info('Role updated', 'User role has been changed.');
    },
    onError: (error) => toast.error('Update failed', toApiError(error)),
  });

  const updateStatus = useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      adminService.updateUserStatus(userId, is_active),
    onSuccess: () => {
      invalidate();
      toast.info('Status updated', 'User access status has been changed.');
    },
    onError: (error) => toast.error('Update failed', toApiError(error)),
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => adminService.deleteUser(userId),
    onSuccess: () => {
      invalidate();
      toast.info('User removed', 'The account has been deleted.');
    },
    onError: (error) => toast.error('Delete failed', toApiError(error)),
  });

  return { updateRole, updateStatus, deleteUser };
}
