"""
Response DTOs — external output shapes.
"""

from typing import Optional
from pydantic import BaseModel

# State → progress percentage mapping
_STATE_PROGRESS = {
    "CREATED": 0,
    "SCRIPT_GENERATED": 25,
    "TTS_GENERATED": 50,
    "CAPTIONS_ALIGNED": 75,
    "RENDERING": 90,
    "COMPLETED": 100,
    "FAILED": -1,
}


def _progress_for_state(state: str) -> int:
    return _STATE_PROGRESS.get(state, 0)


class GenerateVideoResponse(BaseModel):
    """Minimal response after job creation."""

    job_id: str
    state: str


class JobStatusResponse(BaseModel):
    """Full job status via GET /jobs/{job_id}."""

    job_id: str
    persona_id: str
    state: str
    progress: int
    transcript_length: int
    script_length: int
    created_at: float
    updated_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_sec: Optional[float] = None
    output_path: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[dict] = None


class JobLogsResponse(BaseModel):
    """State transition log via GET /jobs/{job_id}/logs."""

    job_id: str
    transitions: list[dict]


class JobArtifactsResponse(BaseModel):
    """Artifact manifest via GET /jobs/{job_id}/artifacts."""

    job_id: str
    artifacts: dict[str, str]