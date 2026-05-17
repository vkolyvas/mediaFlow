"""
Job status endpoints — thin transport adapters.

GET  /api/jobs/{job_id}       — job state + context summary
POST /api/jobs/{job_id}/resume — resume from last checkpoint
GET  /api/jobs/{job_id}/logs   — state transition log
GET  /api/jobs/{job_id}/artifacts — artifact manifest
GET  /api/jobs/{job_id}/download  — serve rendered MP4
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..schemas import (
    JobStatusResponse,
    JobLogsResponse,
    JobArtifactsResponse,
    _progress_for_state,
)
from ...pipeline.orchestrator import PipelineOrchestrator
from ...repositories.jobs import JsonPipelineRepository

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

DEFAULT_OUTPUT_DIR = "/tmp/mediaflow/output"


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

    state_name = job.state.name
    download_url = None
    if job.state.name == "COMPLETED" and ctx.output_path:
        download_url = f"/api/jobs/{job_id}/download"

    return JobStatusResponse(
        job_id=job.job_id,
        persona_id=job.persona_id,
        state=state_name,
        progress=_progress_for_state(state_name),
        transcript_length=job.transcript_length,
        script_length=job.script_length,
        created_at=job.created_at,
        updated_at=job.updated_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_sec=job.duration_sec,
        output_path=ctx.output_path,
        download_url=download_url,
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
    state_name = job.state.name
    download_url = None
    if state_name == "COMPLETED" and _ctx.output_path:
        download_url = f"/api/jobs/{job_id}/download"

    return JobStatusResponse(
        job_id=job.job_id,
        persona_id=job.persona_id,
        state=state_name,
        progress=_progress_for_state(state_name),
        transcript_length=job.transcript_length,
        script_length=job.script_length,
        created_at=job.created_at,
        updated_at=job.updated_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        duration_sec=job.duration_sec,
        output_path=_ctx.output_path,
        download_url=download_url,
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


@router.get("/{job_id}/download")
async def download(job_id: str):
    """
    Serve the rendered MP4 file for completed jobs.
    """
    repo = get_repo()

    try:
        job = await repo.load_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    if job.state.name != "COMPLETED":
        raise HTTPException(status_code=400, detail="Job not completed yet")

    ctx = await repo.load_context(job_id)

    if not ctx.output_path:
        raise HTTPException(status_code=404, detail="Output file not found")

    file_path = ctx.output_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=f"{job_id}.mp4",
        media_type="video/mp4",
    )


@router.get("", response_model=list[JobStatusResponse])
async def list_jobs():
    """
    List all jobs sorted by updated_at descending.
    """
    repo = get_repo()
    all_jobs = repo.list_jobs()

    result = []
    for job in all_jobs:
        try:
            ctx = await repo.load_context(job.job_id)
            error = await repo.load_error(job.job_id)
            state_name = job.state.name
            download_url = None
            if state_name == "COMPLETED" and ctx.output_path:
                download_url = f"/api/jobs/{job.job_id}/download"

            result.append(JobStatusResponse(
                job_id=job.job_id,
                persona_id=job.persona_id,
                state=state_name,
                progress=_progress_for_state(state_name),
                transcript_length=job.transcript_length,
                script_length=job.script_length,
                created_at=job.created_at,
                updated_at=job.updated_at,
                started_at=job.started_at,
                completed_at=job.completed_at,
                duration_sec=job.duration_sec,
                output_path=ctx.output_path,
                download_url=download_url,
                error=error,
            ))
        except Exception:
            continue

    return result


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a job and all its associated data.
    """
    repo = get_repo()

    try:
        await repo.load_job(job_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    deleted = await repo.delete_job(job_id)
    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete job")

    return {"deleted": job_id}