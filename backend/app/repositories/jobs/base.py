"""
Repository protocol for pipeline job persistence.

Orchestrator depends on this interface, not concrete storage.
"""

from typing import Protocol, Optional
from app.pipeline.models import PipelineJob
from app.pipeline.context import GenerationContext
from app.pipeline.states import PipelineState


class PipelineRepository(Protocol):
    """Persistence interface for pipeline jobs and context."""

    async def create_job(self, job: PipelineJob) -> None: ...

    async def save_context(self, ctx: GenerationContext) -> None: ...

    async def load_context(self, job_id: str) -> GenerationContext: ...

    async def update_state(
        self,
        job_id: str,
        state: PipelineState,
    ) -> None: ...

    async def save_artifacts(self, job_id: str, artifacts: dict) -> None: ...

    async def load_artifacts(self, job_id: str) -> dict: ...

    async def job_exists(self, job_id: str) -> bool: ...

    async def load_job(self, job_id: str) -> PipelineJob: ...

    async def save_error(self, job_id: str, error: dict) -> None: ...

    async def load_error(self, job_id: str) -> Optional[dict]: ...
