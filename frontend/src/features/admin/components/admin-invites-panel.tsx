'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, MailPlus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast-provider';
import { adminService } from '@/features/admin/services/admin-service';
import { toApiError } from '@/core/api/errors';
import { Badge } from '@/components/ui/badge';

export function AdminInvitesPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = React.useState('');

  const invitesQuery = useQuery({
    queryKey: ['admin', 'invites'],
    queryFn: () => adminService.listInvites(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { email: string }) => adminService.createInvite(payload),
    onSuccess: (invite) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
      setEmail('');
      toast.success('Invite created', `Registration link generated for ${invite.email}.`);
    },
    onError: (error) => toast.error('Failed to create invite', toApiError(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => adminService.revokeInvite(inviteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'invites'] });
      toast.success('Invite revoked', 'The pending invite was removed.');
    },
    onError: (error) => toast.error('Failed to revoke invite', toApiError(error)),
  });

  const invites = invitesQuery.data ?? [];

  const copyInviteLink = async (invitePath?: string | null, inviteToken?: string | null) => {
    const path = invitePath ?? (inviteToken ? `/admin/register?invite=${inviteToken}` : '');
    if (!path) {
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    await navigator.clipboard.writeText(`${origin}${path}`);
    toast.info('Link copied', 'Share this invite link with the new admin.');
  };

  return (
    <div className="mb-6 rounded-2xl border border-border/40 bg-card/40 p-5">
      <div className="mb-4 flex items-center gap-2">
        <MailPlus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Admin Invites</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Invite new admins with a one-time link instead of sharing the deployment secret key.
      </p>

      <form
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) return;
          createMutation.mutate({ email: email.trim() });
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="admin-invite-email" className="text-xs uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <Input
            id="admin-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending} className="gap-2">
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
          Create invite
        </Button>
      </form>

      <div className="space-y-2">
        {invitesQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading invites…</p>
        ) : invites.length === 0 ? (
          <p className="text-xs text-muted-foreground">No admin invites yet.</p>
        ) : (
          invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-2 rounded-xl border border-border/30 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{invite.email}</span>
                  <Badge variant={invite.status === 'pending' ? 'default' : 'secondary'} className="text-[10px]">
                    {invite.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Expires {new Date(invite.expires_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {invite.status === 'pending' && (invite.invite_path || invite.invite_token) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => void copyInviteLink(invite.invite_path, invite.invite_token)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy link
                  </Button>
                ) : null}
                {invite.status === 'pending' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(invite.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
