"""
Job status endpoints — thin transport adapters.

GET  /api/jobs/{job_id}       — job state + context summary
POST /api/jobs/{job_id}/resume — resume from last checkpoint
GET  /api/jobs/{job_id}/logs   — state transition log
GET  /api/jobs/{job_id}/artifacts — artifact manifest
"""

from fastapi import APIRouter, HTTPException

from ..schemas import (
    JobStatusResponse,
    JobLogsResponse,
    JobArtifactsResponse,
)
from ...pipeline.orchestrator import PipelineOrchestrator
from ...repositories.jobs import JsonPipelineRepository

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def get_repo() -> JsonPipelineRepository:
    return JsonPipelineRepository()


def get_orchestrator() -> PipelineOrchestrator:
    return PipelineOrchestrator()


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Load job state from repository.

    Does NOT execute orchestrator — pure repository read.
    """
    repo = get_repo()

    try:
        job = await repo.load_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    ctx = await repo.load_context(job_id)
    error = await repo.load_error(job_id)

    return JobStatusResponse(
        job_id=job.job_id,
        persona_id=job.persona_id,
        state=job.state.name,
        transcript_length=job.transcript_length,
        script_length=job.script_length,
        created_at=job.created_at,
        updated_at=job.updated_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_sec=job.duration_sec,
        output_path=ctx.output_path,
        error=error,
    )


@router.post("/{job_id}/resume", response_model=JobStatusResponse)
async def resume_job(job_id: str):
    """
    Resume a partial job from last checkpoint.

    Orchestrator loads context, inspects state, continues from next stage.
    """
    repo = get_repo()
    orchestrator = get_orchestrator()

    try:
        job = await repo.load_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    try:
        _ctx, job = await orchestrator.resume_job(job_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume failed: {str(e)}")

    error = await repo.load_error(job_id)

    return JobStatusResponse(
        job_id=job.job_id,
        persona_id=job.persona_id,
        state=job.state.name,
        transcript_length=job.transcript_length,
        script_length=job.script_length,
        created_at=job.created_at,
        updated_at=job.updated_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_sec=job.duration_sec,
        output_path=_ctx.output_path,
        error=error,
    )


@router.get("/{job_id}/logs", response_model=JobLogsResponse)
async def get_job_logs(job_id: str):
    """
    Return state transition log for operational observability.
    """
    repo = get_repo()

    try:
        ctx = await repo.load_context(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return JobLogsResponse(
        job_id=job_id,
        transitions=[
            {
                "from_state": t.from_state.name if hasattr(t.from_state, "name") else str(t.from_state),
                "to_state": t.to_state.name if hasattr(t.to_state, "name") else str(t.to_state),
                "timestamp": t.timestamp,
                "error": t.error,
            }
            for t in ctx.transition_log
        ],
    )


@router.get("/{job_id}/artifacts", response_model=JobArtifactsResponse)
async def get_job_artifacts(job_id: str):
    """
    Return artifact manifest — audio, captions, render paths.
    """
    repo = get_repo()

    try:
        artifacts = await repo.load_artifacts(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return JobArtifactsResponse(
        job_id=job_id,
        artifacts=artifacts,
    )