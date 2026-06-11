import React, { useState } from 'react';
import { useAddRepository } from '../hooks/use-repositories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { useToast } from '@/components/shared/toast-provider';

export function AddRepositoryDialog() {
  const [open, setOpen] = useState(false);
  const [repoId, setRepoId] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');

  const addMutation = useAddRepository();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoId.trim()) {
      toast.error('Validation Error', 'Repository ID is required');
      return;
    }

    try {
      await addMutation.mutateAsync({
        repo_id: repoId,
        remote_url: remoteUrl || null,
        local_path: localPath || null,
        default_branch: defaultBranch
      });
      setOpen(false);
      setRepoId('');
      setRemoteUrl('');
      setLocalPath('');
      setDefaultBranch('main');
    } catch (error) {
      // Error is handled by global toast in mutation or can be handled here
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground">
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="repoId">Repository ID (e.g. org/repo) *</Label>
            <Input
              id="repoId"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              placeholder="my-org/my-repo"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remoteUrl">Remote URL (Optional)</Label>
            <Input
              id="remoteUrl"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="localPath">Local Path (Optional)</Label>
            <Input
              id="localPath"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              placeholder="/path/to/local/clone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultBranch">Default Branch</Label>
            <Input
              id="defaultBranch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {addMutation.isPending ? 'Adding...' : 'Add Repository'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
