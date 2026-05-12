"""
Asset storage with deterministic job_id-based directory layout.

Storage structure:
    storage/
      jobs/
        <job_id>/
          raw/           — original provider output (unmodified)
          normalized/    — FFmpeg-normalized canonical assets
          captions/      — ASS caption files
          renders/       — final rendered MP4s

This layout makes it easy to:
- Re-render from normalized assets without re-fetching from provider
- Audit what raw provider output looked like
- Share individual artifacts (captions, clips) independently
"""

import os
import shutil
from pathlib import Path
from typing import Optional


DEFAULT_STORAGE_ROOT = "/tmp/mediaflow/storage"


class JobStorage:
    """
    Manages per-job storage directories.

    Every job gets a deterministic layout.
    Assets are NEVER dumped flat.
    """

    def __init__(self, root: str = DEFAULT_STORAGE_ROOT):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def job_dir(self, job_id: str) -> Path:
        return self.root / "jobs" / job_id

    def raw_dir(self, job_id: str) -> Path:
        d = self.job_dir(job_id) / "raw"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def normalized_dir(self, job_id: str) -> Path:
        d = self.job_dir(job_id) / "normalized"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def captions_dir(self, job_id: str) -> Path:
        d = self.job_dir(job_id) / "captions"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def renders_dir(self, job_id: str) -> Path:
        d = self.job_dir(job_id) / "renders"
        d.mkdir(parents=True, exist_ok=True)
        return d

    def store_raw(self, job_id: str, filename: str, content: bytes) -> str:
        """Store raw provider output."""
        path = self.raw_dir(job_id) / filename
        path.write_bytes(content)
        return str(path)

    def store_normalized(self, job_id: str, filename: str, content: bytes) -> str:
        """Store normalized asset."""
        path = self.normalized_dir(job_id) / filename
        path.write_bytes(content)
        return str(path)

    def store_caption(self, job_id: str, filename: str, content: str) -> str:
        """Store caption file (ASS)."""
        path = self.captions_dir(job_id) / filename
        path.write_text(content)
        return str(path)

    def store_render(self, job_id: str, filename: str, content: bytes) -> str:
        """Store final render."""
        path = self.renders_dir(job_id) / filename
        path.write_bytes(content)
        return str(path)

    def path_for(self, job_id: str, stage: str, filename: str) -> str:
        """
        Get path for a specific artifact.

        Args:
            job_id:  The job ID
            stage:   One of raw/normalized/captions/renders
            filename: The filename within that stage
        """
        return str(getattr(self, f"{stage}_dir")(job_id) / filename)

    def cleanup(self, job_id: str):
        """Delete all artifacts for a job."""
        shutil.rmtree(self.job_dir(job_id), ignore_errors=True)

    def exists(self, job_id: str) -> bool:
        """Check if job directory exists."""
        return self.job_dir(job_id).exists()


_storage = None


def get_storage(root: Optional[str] = None) -> JobStorage:
    global _storage
    if _storage is None or root is not None:
        _storage = JobStorage(root or DEFAULT_STORAGE_ROOT)
    return _storage
