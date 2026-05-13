"""
POST /api/generate — thin transport adapter.

Submits job and returns immediately. Pipeline runs in background
via FastAPI BackgroundTasks — does not block the request lifecycle.
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException

from ..schemas import GenerateVideoRequest, GenerateVideoResponse
from ...pipeline.orchestrator import PipelineOrchestrator

router = APIRouter(prefix="/api/generate", tags=["generate"])


def get_orchestrator() -> PipelineOrchestrator:
    return PipelineOrchestrator()


@router.post("", response_model=GenerateVideoResponse)
async def generate_video(
    request: GenerateVideoRequest,
    background_tasks: BackgroundTasks,
):
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

    # Run pipeline in background — request returns immediately
    background_tasks.add_task(orchestrator.run_pipeline, job_id, context, job)

    return GenerateVideoResponse(
        job_id=job_id,
        state=job.state.name,
    )