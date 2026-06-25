import subprocess
import shutil
import logging
from pathlib import Path
from app.core.config import settings
from app.db.models import ActPatchFile

logger = logging.getLogger(__name__)

class SandboxManager:
    def get_sandbox_path(self, patch_id: str, sandbox_base_dir: Path | None = None) -> Path:
        if sandbox_base_dir:
            return sandbox_base_dir / patch_id
        cache_parent = Path(settings.repo_cache_path).resolve().parent
        return cache_parent / "sandbox" / patch_id

    def create_sandbox(
        self,
        patch_id: str,
        repository_path: Path,
        commit_sha: str,
        sandbox_base_dir: Path | None = None
    ) -> Path:
        sandbox_path = self.get_sandbox_path(patch_id, sandbox_base_dir)
        # Ensure parent directory exists
        sandbox_path.parent.mkdir(parents=True, exist_ok=True)
        
        # In case worktree exists, clean it first
        if sandbox_path.exists():
            self.destroy_sandbox(patch_id, repository_path, sandbox_base_dir)
            
        cmd = [
            "git", "-C", str(repository_path),
            "worktree", "add", "--detach", str(sandbox_path), commit_sha
        ]
        logger.info(f"Creating git worktree: {' '.join(cmd)}")
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if res.returncode != 0:
            raise RuntimeError(f"Failed to create worktree: {res.stderr}")
            
        return sandbox_path

    def apply_patch_files(self, sandbox_path: Path, patch_files: list[ActPatchFile]) -> None:
        for pf in patch_files:
            if not pf.file_diff or not pf.file_diff.strip():
                continue
            cmd = [
                "git", "apply", "--ignore-space-change", "--ignore-whitespace"
            ]
            logger.info(f"Applying patch to {pf.file_path} in sandbox {sandbox_path}")
            res = subprocess.run(
                cmd,
                input=pf.file_diff.encode("utf-8"),
                cwd=str(sandbox_path),
                capture_output=True
            )
            if res.returncode != 0:
                err = res.stderr.decode("utf-8")
                raise RuntimeError(f"Failed to apply patch on {pf.file_path}: {err}")

    def destroy_sandbox(
        self,
        patch_id: str,
        repository_path: Path,
        sandbox_base_dir: Path | None = None
    ) -> None:
        sandbox_path = self.get_sandbox_path(patch_id, sandbox_base_dir)
        
        cmd = [
            "git", "-C", str(repository_path),
            "worktree", "remove", "--force", str(sandbox_path)
        ]
        logger.info(f"Removing git worktree: {' '.join(cmd)}")
        subprocess.run(cmd, capture_output=True)
        
        if sandbox_path.exists():
            shutil.rmtree(sandbox_path, ignore_errors=True)
