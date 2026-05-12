"""
Pipeline job persistence — Job record stored alongside generation artifacts.

Pipeline jobs are stored in the same job directory as other artifacts:
    storage/jobs/<job_id>/
      job.json          — Job metadata
      context.json      — GenerationContext snapshot
      raw/              — Provider output
      normalized/      — FFmpeg-normalized assets
      captions/         — ASS caption files
      renders/          — final MP4s
"""

import json
from dataclasses import dataclass
from typing import Optional

from .states import PipelineState


@dataclass
class PipelineJob:
    """
    Persisted representation of a pipeline run.

    Stored as job.json alongside generation artifacts.
    """
    job_id: str
    persona_id: str
    state: PipelineState
    created_at: float
    updated_at: float
    transcript_length: int = 0
    script_length: int = 0
    error_message: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    duration_sec: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "persona_id": self.persona_id,
            "state": self.state.name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "transcript_length": self.transcript_length,
            "script_length": self.script_length,
            "error_message": self.error_message,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_sec": self.duration_sec,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PipelineJob":
        return cls(
            job_id=data["job_id"],
            persona_id=data["persona_id"],
            state=PipelineState[data["state"]],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            transcript_length=data.get("transcript_length", 0),
            script_length=data.get("script_length", 0),
            error_message=data.get("error_message"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            duration_sec=data.get("duration_sec"),
        )
