"use client";

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AdminUser, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AdminUsersPage(): React.JSX.Element {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadUsers = React.useCallback(async () => {
    setError(null);
    try {
      const data = await api.admin.users();
      setUsers(data);
    } catch (requestError) {
      setError(toApiError(requestError));
    }
  }, []);

  React.useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const updateRole = async (user: AdminUser): Promise<void> => {
    setBusyUserId(user.id);
    setError(null);
    try {
      await api.admin.updateUserRole(user.id, user.role === "ADMIN" ? "USER" : "ADMIN");
      await loadUsers();
    } catch (requestError) {
      setError(toApiError(requestError));
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
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setBusyUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser): Promise<void> => {
    const shouldDelete = window.confirm(`Delete user ${user.email}?`);
    if (!shouldDelete) {
      return;
    }

    setBusyUserId(user.id);
    setError(null);
    try {
      await api.admin.deleteUser(user.id);
      await loadUsers();
    } catch (requestError) {
      setError(toApiError(requestError));
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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="pt-6">
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
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "ADMIN" ? "warning" : "muted"}>{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "success" : "danger"}>
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
                          variant="danger"
                          disabled={busyUserId === user.id}
                          onClick={() => void deleteUser(user)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
