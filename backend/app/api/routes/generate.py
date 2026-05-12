"""
POST /api/generate — thin transport adapter.

Does NOT block on rendering. Submits job and returns immediately.
Orchestrator runs synchronously for now, but the contract is:
submit → return job_id → job runs in background (future queue).
"""

from fastapi import APIRouter, HTTPException

from ..schemas import GenerateVideoRequest, GenerateVideoResponse
from ...pipeline.orchestrator import PipelineOrchestrator

router = APIRouter(prefix="/api/generate", tags=["generate"])


def get_orchestrator() -> PipelineOrchestrator:
    return PipelineOrchestrator()


@router.post("", response_model=GenerateVideoResponse)
async def generate_video(request: GenerateVideoRequest):
    """
    Submit a video generation job.

    Returns immediately with job_id. Orchestrator handles all pipeline logic.
    """
    orchestrator = get_orchestrator()

    try:
        _ctx, job = await orchestrator.generate_video(
            transcript=request.transcript,
            persona_id=request.persona_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    return GenerateVideoResponse(
        job_id=job.job_id,
        state=job.state.name,
    )