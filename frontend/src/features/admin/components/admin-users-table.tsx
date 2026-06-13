'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AdminUser } from '@/features/admin/services/admin-service';
import { adminService } from '@/features/admin/services/admin-service';
import { AdminUserActionsDialog } from './admin-user-actions-dialog';

const PAGE_SIZE = 20;

export function AdminUsersTable() {
  const [page, setPage] = React.useState(0);
  const [selectedUser, setSelectedUser] = React.useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => adminService.users({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });

  const users = usersQuery.data?.items ?? [];
  const pagination = usersQuery.data?.pagination;
  const total = pagination?.total ?? users.length;
  const hasMore = pagination?.has_more ?? false;

  const openManage = (user: AdminUser) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  if (usersQuery.isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <>
      <div className="rounded-2xl border border-border/40 bg-card/60 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground lg:text-base xl:text-lg">Access & User Management</h2>
          </div>
          {total > 0 && (
            <span className="text-xs text-muted-foreground">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
          )}
        </div>

        <div className="hidden overflow-x-auto rounded-xl border border-border/40 bg-muted/20 md:block">
          <table className="w-full text-left text-sm text-foreground/80">
            <thead className="border-b border-border/40 bg-muted/40 text-xs font-bold uppercase tracking-widest text-muted-foreground xl:text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">User Details</th>
                <th className="px-6 py-4 font-medium">Role</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {users.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-6 py-4">
                    <div className="font-medium text-foreground">{user.full_name || 'Anonymous User'}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-success' : 'bg-destructive'}`}
                      />
                      <span className="text-xs font-medium">{user.is_active ? 'Active' : 'Disabled'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs hover:bg-muted hover:text-foreground"
                      onClick={() => openManage(user)}
                    >
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="border-dashed px-6 py-8 text-center text-muted-foreground">
                    No users found in the system.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-border/40 bg-muted/20 p-4">
              <div className="font-medium text-foreground">{user.full_name || 'Anonymous User'}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
                  {user.role}
                </Badge>
                <span className="text-xs text-muted-foreground">{user.is_active ? 'Active' : 'Disabled'}</span>
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openManage(user)}>
                Manage
              </Button>
            </div>
          ))}
        </div>

        {(page > 0 || hasMore) && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <AdminUserActionsDialog user={selectedUser} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
