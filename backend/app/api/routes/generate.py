"""
POST /api/generate — thin transport adapter.

Submits job and returns immediately. Pipeline runs in background
via FastAPI BackgroundTasks — does not block the request lifecycle.
"""

from fastapi import APIRouter, HTTPException
import asyncio

from ..schemas import GenerateVideoRequest, GenerateVideoResponse
from ...pipeline.orchestrator import PipelineOrchestrator

router = APIRouter(prefix="/api/generate-video", tags=["generate"])


def get_orchestrator() -> PipelineOrchestrator:
    return PipelineOrchestrator()


async def _run_pipeline_async(job_id: str, transcript: str, persona_id: str):
    """Wrapper to run pipeline in background with its own orchestrator instance."""
    try:
        orchestrator = PipelineOrchestrator()
        # Create job
        _, context, job = await orchestrator.create_job(
            transcript=transcript,
            persona_id=persona_id,
            job_id=job_id,
        )
        # Run pipeline
        await orchestrator.run_pipeline(job_id, context, job)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background pipeline failed for {job_id}: {e}")


@router.post("", response_model=GenerateVideoResponse)
async def generate_video(request: GenerateVideoRequest):
    """
    Submit a video generation job.

    Returns immediately with job_id. Pipeline executes in background.
    Poll GET /api/jobs/{job_id} for status updates.
    """
    orchestrator = get_orchestrator()

    try:
        job_id, context, job = await orchestrator.create_job(
            transcript=request.transcript,
            persona_id=request.persona_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

    # Run pipeline in background without blocking the request
    asyncio.create_task(_run_pipeline_async(job_id, request.transcript, request.persona_id))

    return GenerateVideoResponse(
        job_id=job_id,
        state=job.state.name,
    )