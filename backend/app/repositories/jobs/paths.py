"""
Job directory path resolution.

Centralizes all path construction so no service invents paths independently.
"""

from pathlib import Path
from dataclasses import dataclass


DEFAULT_STORAGE_ROOT = "/tmp/mediaflow/storage"


@dataclass
class JobPaths:
    """
    Deterministic job directory layout.

    All paths for a job live under:
        storage/jobs/<job_id>/

    Layout:
        job.json
        context.json
        artifacts.json
        error.json

        raw/           — original provider output
        normalized/    — FFmpeg-normalized assets
        captions/      — ASS caption files
        renders/       — final rendered MP4s
        manifests/     — scene manifests
        logs/          — stage execution logs
    """
    job_id: str
    root: Path

    @property
    def job_dir(self) -> Path:
        return self.root / "jobs" / self.job_id

    @property
    def raw_dir(self) -> Path:
        return self.job_dir / "raw"

    @property
    def normalized_dir(self) -> Path:
        return self.job_dir / "normalized"

    @property
    def captions_dir(self) -> Path:
        return self.job_dir / "captions"

    @property
    def renders_dir(self) -> Path:
        return self.job_dir / "renders"

    @property
    def manifests_dir(self) -> Path:
        return self.job_dir / "manifests"

    @property
    def logs_dir(self) -> Path:
        return self.job_dir / "logs"

    @property
    def job_file(self) -> Path:
        return self.job_dir / "job.json"

    @property
    def context_file(self) -> Path:
        return self.job_dir / "context.json"

    @property
    def context_tmp_file(self) -> Path:
        return self.job_dir / "context.json.tmp"

    @property
    def artifacts_file(self) -> Path:
        return self.job_dir / "artifacts.json"

    @property
    def error_file(self) -> Path:
        return self.job_dir / "error.json"

    def ensure_dirs(self) -> "JobPaths":
        """Create all directories for this job."""
        for d in [
            self.job_dir,
            self.raw_dir,
            self.normalized_dir,
            self.captions_dir,
            self.renders_dir,
            self.manifests_dir,
            self.logs_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)
        return self


def get_job_paths(job_id: str, root: str = DEFAULT_STORAGE_ROOT) -> JobPaths:
    return JobPaths(job_id=job_id, root=Path(root))
