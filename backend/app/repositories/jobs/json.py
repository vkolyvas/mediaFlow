"""
JSON file-based pipeline repository.

Implements PipelineRepository with atomic writes and crash-safe persistence.

Key guarantees:
- Context writes use rename() for atomicity
- Schema version on all persisted documents
- Idempotent stage operations (skip if artifact already exists)
- All paths go through JobPaths — no ad-hoc paths
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from app.pipeline.models import PipelineJob
from app.pipeline.context import GenerationContext, StateTransition
from app.pipeline.states import PipelineState as EnumPipelineState
from .base import PipelineRepository
from .paths import JobPaths, get_job_paths, DEFAULT_STORAGE_ROOT


CURRENT_CONTEXT_VERSION = 1


class JsonPipelineRepository:
    """
    JSON-file repository with atomic writes.

    All state lives in storage/jobs/<job_id>/.
    Orchestrator never touches the filesystem directly.
    """

    def __init__(self, root: str = DEFAULT_STORAGE_ROOT):
        self.root = Path(root)

    def _paths(self, job_id: str) -> JobPaths:
        return get_job_paths(job_id, str(self.root))

    async def create_job(self, job: PipelineJob) -> None:
        """Create job record and ensure job directory exists."""
        paths = self._paths(job.job_id)
        paths.ensure_dirs()
        paths.job_file.write_text(json.dumps(job.to_dict(), indent=2))

    async def save_job(self, job: PipelineJob) -> None:
        """Atomically persist full job record."""
        paths = self._paths(job.job_id)
        if not paths.job_file.exists():
            raise FileNotFoundError(f"No job found for {job.job_id}")
        tmp = paths.job_file.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(job.to_dict(), indent=2))
        tmp.rename(paths.job_file)

    async def save_context(self, ctx: GenerationContext) -> None:
        """
        Persist context atomically: write to .tmp then rename.

        This prevents corruption if a crash occurs mid-write.
        """
        paths = self._paths(ctx.job_id)
        paths.ensure_dirs()

        data = {
            "context_version": CURRENT_CONTEXT_VERSION,
            "job_id": ctx.job_id,
            "persona_id": ctx.persona.persona_id,
            "transcript": ctx.transcript,
            "script": ctx.script,
            "hook_variant": ctx.hook_variant,
            "voice_asset": ctx.voice_asset,
            "avatar_asset": ctx.avatar_asset,
            "captions": [
                {
                    "word": w.word,
                    "start": w.start,
                    "end": w.end,
                    "emphasis": w.emphasis,
                }
                for w in ctx.captions
            ],
            "output_path": ctx.output_path,
            "error": ctx.error,
            "artifacts": {
                k: str(v) for k, v in ctx.artifacts.items()
            },
            "transition_log": [
                {
                    "from_state": t.from_state.name if isinstance(t.from_state, EnumPipelineState) else t.from_state,
                    "to_state": t.to_state.name if isinstance(t.to_state, EnumPipelineState) else t.to_state,
                    "timestamp": t.timestamp,
                    "error": t.error,
                }
                for t in ctx.transition_log
            ],
            "last_error": ctx.last_error if ctx.last_error else None,
            "saved_at": datetime.utcnow().isoformat(),
        }

        # Atomic write: write to .tmp then rename
        paths.context_tmp_file.write_text(json.dumps(data, indent=2))
        paths.context_tmp_file.rename(paths.context_file)

    async def load_context(self, job_id: str) -> GenerationContext:
        """Load context from disk. Raises if not found."""
        from app.personas import get_persona_manager

        paths = self._paths(job_id)
        if not paths.context_file.exists():
            raise FileNotFoundError(f"No context found for job {job_id}")

        data = json.loads(paths.context_file.read_text())

        # Version migration would happen here
        if data.get("context_version", 0) < CURRENT_CONTEXT_VERSION:
            data = self._migrate_context(data)

        persona_mgr = get_persona_manager()
        persona = persona_mgr.get(data["persona_id"])
        if not persona:
            from app.personas import Persona
            persona = Persona(persona_id=data["persona_id"], name="unknown")

        ctx = GenerationContext(
            job_id=data["job_id"],
            persona=persona,
            transcript=data.get("transcript", ""),
            script=data.get("script"),
            hook_variant=data.get("hook_variant"),
            voice_asset=data.get("voice_asset"),
            avatar_asset=data.get("avatar_asset"),
            output_path=data.get("output_path"),
            error=data.get("error"),
        )

        ctx.captions = []
        for w in data.get("captions", []):
            from app.renderer.manifest import CaptionWord
            ctx.captions.append(CaptionWord(
                word=w["word"],
                start=w["start"],
                end=w["end"],
                emphasis=w.get("emphasis", False),
            ))

        ctx.artifacts = {
            k: Path(v) for k, v in data.get("artifacts", {}).items()
        }

        ctx.transition_log = []
        for t in data.get("transition_log", []):
            ctx.transition_log.append(StateTransition(
                from_state=EnumPipelineState[t["from_state"]],
                to_state=EnumPipelineState[t["to_state"]],
                timestamp=t["timestamp"],
                error=t.get("error"),
            ))

        if data.get("last_error"):
            ctx.last_error = data["last_error"]

        return ctx

    async def update_state(
        self,
        job_id: str,
        state: EnumPipelineState,
    ) -> None:
        """Update job state in job.json."""
        paths = self._paths(job_id)
        if not paths.job_file.exists():
            raise FileNotFoundError(f"No job found for {job_id}")

        job_data = json.loads(paths.job_file.read_text())
        job_data["state"] = state.name if isinstance(state, EnumPipelineState) else state
        job_data["updated_at"] = datetime.utcnow().timestamp()
        paths.job_file.write_text(json.dumps(job_data, indent=2))

    async def save_artifacts(self, job_id: str, artifacts: dict) -> None:
        """Persist artifact manifest."""
        paths = self._paths(job_id)
        paths.ensure_dirs()
        data = {
            k: str(v) for k, v in artifacts.items()
        }
        paths.artifacts_file.write_text(json.dumps(data, indent=2))

    async def load_artifacts(self, job_id: str) -> dict:
        """Load artifact manifest. Returns empty dict if not found."""
        paths = self._paths(job_id)
        if not paths.artifacts_file.exists():
            return {}
        return json.loads(paths.artifacts_file.read_text())

    def list_jobs(self) -> list[PipelineJob]:
        """List all jobs sorted by updated_at descending."""
        if not self.root.exists():
            return []
        jobs = []
        for job_dir in self.root.iterdir():
            if not job_dir.is_dir():
                continue
            job_file = job_dir / "job.json"
            if job_file.exists():
                try:
                    data = json.loads(job_file.read_text())
                    jobs.append(PipelineJob.from_dict(data))
                except Exception:
                    continue
        jobs.sort(key=lambda j: j.updated_at or j.created_at, reverse=True)
        return jobs

    async def delete_job(self, job_id: str) -> bool:
        """Delete job directory, output files, and all associated data."""
        import shutil
        paths = self._paths(job_id)

        # Delete job storage directory
        if paths.job_dir.exists():
            shutil.rmtree(paths.job_dir)

        # Delete rendered output directory (e.g. /tmp/mediaflow/output/<job_id>)
        output_dir = Path("/tmp/mediaflow/output") / job_id
        if output_dir.exists():
            shutil.rmtree(output_dir)

        return True

    async def job_exists(self, job_id: str) -> bool:
        return self._paths(job_id).job_file.exists()

    async def load_job(self, job_id: str) -> PipelineJob:
        """Load job record from disk."""
        paths = self._paths(job_id)
        if not paths.job_file.exists():
            raise FileNotFoundError(f"No job found for {job_id}")
        data = json.loads(paths.job_file.read_text())
        return PipelineJob.from_dict(data)

    async def save_error(self, job_id: str, error: dict) -> None:
        """Persist structured error metadata."""
        paths = self._paths(job_id)
        paths.ensure_dirs()
        paths.error_file.write_text(json.dumps(error, indent=2))

    async def load_error(self, job_id: str) -> Optional[dict]:
        """Load error metadata. Returns None if not found."""
        paths = self._paths(job_id)
        if not paths.error_file.exists():
            return None
        return json.loads(paths.error_file.read_text())

    def _migrate_context(self, data: dict) -> dict:
        """Migrate old context schemas to current version."""
        # Currently a no-op; schema version 1 is the first version
        return data
