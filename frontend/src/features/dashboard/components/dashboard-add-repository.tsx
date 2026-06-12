'use client';

import * as React from 'react';
import { useAddRepository } from '@/features/repositories/hooks/use-repositories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, FolderGit2 } from 'lucide-react';
import { useToast } from '@/components/shared/toast-provider';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardAddRepositoryProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

export function DashboardAddRepository({
  open: controlledOpen,
  onOpenChange,
  triggerRef,
}: DashboardAddRepositoryProps = {}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [repoId, setRepoId] = React.useState('');
  const [remoteUrl, setRemoteUrl] = React.useState('');
  const [localPath, setLocalPath] = React.useState('');
  const [defaultBranch, setDefaultBranch] = React.useState('main');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const addMutation = useAddRepository();
  const toast = useToast();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setRepoId('');
    setRemoteUrl('');
    setLocalPath('');
    setDefaultBranch('main');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId.trim()) {
      toast.error('Validation Error', 'Repository ID is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await addMutation.mutateAsync({
        repo_id: repoId.trim(),
        remote_url: remoteUrl.trim() || null,
        local_path: localPath.trim() || null,
        default_branch: defaultBranch.trim() || 'main',
      });

      setOpen(false);
      resetForm();

      // Refresh dashboard data
      void queryClient.invalidateQueries({ queryKey: ['repositories'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      // Error handled by mutation hook toasts
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button ref={triggerRef} id="add-repository-btn" className="gap-2 shadow-glow-sm">
          <Plus className="h-4 w-4" />
          Add Repository
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderGit2 className="h-5 w-5 text-primary" />
            Add Repository
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="dash-repoId">Repository ID *</Label>
            <Input
              id="dash-repoId"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              placeholder="owner/repository"
              required
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              e.g. facebook/react or my-project
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dash-remoteUrl">Remote URL</Label>
            <Input
              id="dash-remoteUrl"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/owner/repo.git"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dash-localPath">Local Path</Label>
            <Input
              id="dash-localPath"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="C:\Projects\my-repo"
            />
            <p className="text-[10px] text-muted-foreground">
              Provide either a Remote URL or a Local Path
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dash-branch">Default Branch</Label>
            <Input
              id="dash-branch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Add Repository'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
