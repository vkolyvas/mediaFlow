"""
Pipeline error metadata — structured error storage for failed jobs.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class PipelineError:
    """Structured error metadata for pipeline failures."""
    stage: str
    error_type: str
    message: str
    traceback: str
    timestamp: datetime

    def to_dict(self) -> dict:
        return {
            "stage": self.stage,
            "error_type": self.error_type,
            "message": self.message,
            "traceback": self.traceback,
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PipelineError":
        return cls(
            stage=data["stage"],
            error_type=data["error_type"],
            message=data["message"],
            traceback=data["traceback"],
            timestamp=datetime.fromisoformat(data["timestamp"]),
        )
