"""
MiniMax request/response models and capability discovery.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MiniMaxCapabilities:
    """
    Discovered capabilities of the MiniMax API.

    Populated by querying the API on startup or cached after first call.
    Do NOT hardcode these — derive from real API responses.
    """
    max_video_duration_seconds: float = 30.0
    max_tts_duration_seconds: float = 300.0
    supported_video_resolutions: tuple[str, ...] = ("1280x720", "1920x1080")
    supported_video_formats: tuple[str, ...] = ("mp4", "webm")
    supports_async_jobs: bool = True
    embedded_audio_in_video: bool = False
    rate_limit_rpm: int = 30
    requires_poll_for_video: bool = True
    requires_poll_for_tts: bool = False


@dataclass
class AvatarJobStatus:
    job_id: str
    status: str
    progress: float = 0.0
    message: str = ""
    video_url: Optional[str] = None
    audio_url: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class AvatarJobResponse:
    job_id: str
    status: AvatarJobStatus
    created_at: float


@dataclass
class TTSJobStatus:
    job_id: str
    status: str
    audio_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class TTSJobResponse:
    job_id: str
    status: TTSJobStatus
    created_at: float


@dataclass
class TTSRequest:
    text: str
    voice: str = "mx_001"
    speed: float = 1.0
    pitch: float = 0.0
    volume: float = 1.0


@dataclass
class AvatarRequest:
    script: str
    voice: str = "mx_001"
    avatar_id: str = "default"
    resolution: str = "1920x1080"
    fps: int = 30
