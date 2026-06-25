'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { AdminUser } from '@/features/admin/services/admin-service';
import { useAdminUserMutations } from '@/features/admin/hooks/use-admin-user-mutations';

interface AdminUserActionsDialogProps {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminUserActionsDialog({ user, open, onOpenChange }: AdminUserActionsDialogProps) {
  const { updateRole, updateStatus, deleteUser } = useAdminUserMutations();
  const [role, setRole] = React.useState<'USER' | 'ADMIN'>('USER');

  React.useEffect(() => {
    if (user) {
      setRole(user.role === 'ADMIN' ? 'ADMIN' : 'USER');
    }
  }, [user]);

  if (!user) return null;

  const busy =
    updateRole.isPending || updateStatus.isPending || deleteUser.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage user</DialogTitle>
          <DialogDescription>
            {user.full_name || 'User'} — {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="admin-user-role">Role</Label>
            <select
              id="admin-user-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'USER' | 'ADMIN')}
              className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Status: {user.is_active ? 'Active' : 'Disabled'}
          </p>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
                deleteUser.mutate(user.id, { onSuccess: () => onOpenChange(false) });
              }
            }}
          >
            Delete user
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                updateStatus.mutate(
                  { userId: user.id, is_active: !user.is_active },
                  { onSuccess: () => onOpenChange(false) }
                )
              }
            >
              {user.is_active ? 'Deactivate' : 'Activate'}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                updateRole.mutate({ userId: user.id, role }, { onSuccess: () => onOpenChange(false) })
              }
            >
              Save role
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
