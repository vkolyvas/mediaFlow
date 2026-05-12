"""
MiniMax service — orchestration layer for MiniMax video/avatar generation.

Submodules:
    client      — HTTP client with retry/timeout
    models      — request/response schemas
    adapters    — MiniMax payload → internal canonical contract
    polling    — async job polling with backoff
    storage    — job storage with raw/normalized/captions/renders layout
    inspector  — ffprobe media metadata extraction
    normalize  — FFmpeg normalization to canonical spec
"""

from .client import MiniMaxClient
from .models import (
    MiniMaxCapabilities,
    AvatarJobStatus,
    AvatarJobResponse,
    TTSJobStatus,
    TTSJobResponse,
)
from .adapters import AvatarAsset, normalize_avatar_asset, MiniMaxAdapter
from .polling import poll_until_done, PollingConfig
from .inspector import MediaInspector, MediaMetadata
from .normalize import normalize_video_asset, NormalizedAsset
from .storage import JobStorage, get_storage
from .exceptions import (
    MiniMaxError,
    MiniMaxAPIError,
    MiniMaxTimeoutError,
    MiniMaxRateLimitError,
    AssetNormalizationError,
)

__all__ = [
    "MiniMaxClient",
    "MiniMaxCapabilities",
    "AvatarJobStatus",
    "AvatarJobResponse",
    "TTSJobStatus",
    "TTSJobResponse",
    "AvatarAsset",
    "normalize_avatar_asset",
    "MiniMaxAdapter",
    "poll_until_done",
    "PollingConfig",
    "MediaInspector",
    "MediaMetadata",
    "normalize_video_asset",
    "NormalizedAsset",
    "JobStorage",
    "get_storage",
    "MiniMaxError",
    "MiniMaxAPIError",
    "MiniMaxTimeoutError",
    "MiniMaxRateLimitError",
    "AssetNormalizationError",
]
