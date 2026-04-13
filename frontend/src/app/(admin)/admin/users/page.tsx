"use client";

import * as React from "react";
import { ShieldCheck, UserCog2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/shared/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AdminUser, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AdminUsersPage(): React.JSX.Element {
  const toast = useToast();
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = React.useState<string | null>(null);
  const [isLoading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!pendingDeleteUserId) {
      return;
    }
    const timer = window.setTimeout(() => setPendingDeleteUserId(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingDeleteUserId]);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.users();
      setUsers(data);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Failed to load users", message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateRole = async (user: AdminUser): Promise<void> => {
    setBusyUserId(user.id);
    setError(null);
    try {
      await api.admin.updateUserRole(user.id, user.role === "ADMIN" ? "USER" : "ADMIN");
      await loadUsers();
      toast.success("Role updated", `${user.email} role has been updated.`);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Role update failed", message);
    } finally {
      setBusyUserId(null);
    }
  };

  const updateStatus = async (user: AdminUser): Promise<void> => {
    setBusyUserId(user.id);
    setError(null);
    try {
      await api.admin.updateUserStatus(user.id, !user.is_active);
      await loadUsers();
      toast.success("Status updated", `${user.email} status has been changed.`);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Status update failed", message);
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser): Promise<void> => {
    if (pendingDeleteUserId !== user.id) {
      setPendingDeleteUserId(user.id);
      toast.warning('Confirm Deletion', `Click Delete again for ${user.email} to confirm.`);
      return;
    }

    setPendingDeleteUserId(null);
    setBusyUserId(user.id);
    setError(null);
    try {
      await api.admin.deleteUser(user.id);
      await loadUsers();
      toast.success("User deleted", `${user.email} was removed.`);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("User deletion failed", message);
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Users"
        description="Promote, suspend, and remove accounts."
        actions={
          <Button variant="secondary" onClick={() => void loadUsers()}>
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadUsers()} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <UserCog2 className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Role and status updates are applied via admin APIs without page reloads.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Admin actions are protected and reflected immediately in the user table.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "ADMIN" ? "warning" : "muted"}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "success" : "error"}>
                        {user.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.created_at ? formatDate(user.created_at) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyUserId === user.id}
                          onClick={() => void updateRole(user)}
                        >
                          Toggle Role
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busyUserId === user.id}
                          onClick={() => void updateStatus(user)}
                        >
                          Toggle Status
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyUserId === user.id}
                          onClick={() => void deleteUser(user)}
                        >
                          {pendingDeleteUserId === user.id ? 'Confirm Delete' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState title="No users found" description="There are no users in the system yet." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

