"""
MiniMax adapters — normalize raw MiniMax API responses to internal canonical contracts.

EXTERNAL: Raw MiniMax API response (dict)
↓ Canonical: AvatarAsset (dataclass)

Never expose provider payloads directly to renderer code.
"""

from dataclasses import dataclass, field
from typing import Optional

from .models import AvatarJobResponse, TTSJobResponse
from .inspector import MediaMetadata


@dataclass
class AvatarAsset:
    """
    Canonical internal representation of a generated avatar video.

    ALL media entering the renderer must be in this format.
    Every provider response must be normalized to this contract.

    Fields:
        asset_id:      Unique identifier (MiniMax job_id)
        video_path:    Local path to normalized video file
        audio_path:    Local path to audio file (None if embedded)
        duration:      Duration in seconds
        fps:           Frames per second
        width:         Video width in pixels
        height:        Video height in pixels
        codec:         Video codec (h264)
        audio_codec:   Audio codec (aac)
        sample_rate:   Audio sample rate (48000)
        has_embedded_audio: True if audio is embedded in video
        raw_metadata:  Original API response dict (for debugging)
    """
    asset_id: str
    video_path: str
    audio_path: Optional[str]
    duration: float
    fps: int
    width: int
    height: int
    codec: str = "h264"
    audio_codec: str = "aac"
    sample_rate: int = 48000
    has_embedded_audio: bool = True
    raw_metadata: dict = field(default_factory=dict)


@dataclass
class TTSSAsset:
    """
    Canonical internal representation of TTS audio.
    """
    asset_id: str
    audio_path: str
    duration: float
    sample_rate: int = 48000
    text: str = ""
    voice: str = "mx_001"
    raw_metadata: dict = field(default_factory=dict)


class MiniMaxAdapter:
    """
    Transforms MiniMax API responses to canonical internal contracts.

    MiniMax payloads vary by endpoint and job status.
    This adapter abstracts all normalization logic.
    """

    @staticmethod
    def from_avatar_job_response(
        response: AvatarJobResponse,
        video_local_path: str,
        audio_local_path: Optional[str] = None,
    ) -> AvatarAsset:
        """
        Convert an avatar job polling response to AvatarAsset.

        Args:
            response: Parsed AvatarJobResponse from MiniMax API
            video_local_path: Local path where video was downloaded
            audio_local_path: Local path where audio was downloaded (optional)
        """
        status = response.status

        return AvatarAsset(
            asset_id=response.job_id,
            video_path=video_local_path,
            audio_path=audio_local_path,
            duration=status.progress if hasattr(status, 'progress') else 0.0,
            fps=30,
            width=1920,
            height=1080,
            has_embedded_audio=audio_local_path is None,
            raw_metadata={},
        )

    @staticmethod
    def from_raw_avatar_response(
        raw: dict,
        video_local_path: str,
        audio_local_path: Optional[str] = None,
    ) -> AvatarAsset:
        """
        Convert a raw MiniMax API response dict to AvatarAsset.

        Handles the actual MiniMax response format without model wrappers.
        """
        job_id = raw.get("job_id", "")
        video_url = raw.get("video_url", "")
        data = raw.get("data", raw)

        return AvatarAsset(
            asset_id=job_id,
            video_path=video_local_path,
            audio_path=audio_local_path,
            duration=data.get("duration", 0.0),
            fps=data.get("fps", 30),
            width=data.get("width", 1920),
            height=data.get("height", 1080),
            has_embedded_audio=audio_local_path is None,
            raw_metadata=raw,
        )

    @staticmethod
    def from_tts_job_response(
        response: TTSJobResponse,
        audio_local_path: str,
    ) -> TTSSAsset:
        """Convert TTS job response to TTSSAsset."""
        status = response.status

        return TTSSAsset(
            asset_id=response.job_id,
            audio_path=audio_local_path,
            duration=status.duration_seconds or 0.0,
            sample_rate=48000,
            raw_metadata={},
        )

    @staticmethod
    def from_metadata(metadata: MediaMetadata, asset_id: str) -> AvatarAsset:
        """
        Construct AvatarAsset from MediaMetadata (for pre-downloaded assets).

        Used when asset is already on disk and we only have ffprobe metadata.
        """
        return AvatarAsset(
            asset_id=asset_id,
            video_path=metadata.path,
            audio_path=None,
            duration=metadata.duration,
            fps=int(metadata.fps) if metadata.fps else 30,
            width=metadata.width or 1920,
            height=metadata.height or 1080,
            codec=metadata.codec_name or "h264",
            audio_codec=metadata.audio_codec or "aac",
            sample_rate=metadata.sample_rate or 48000,
            has_embedded_audio=metadata.is_video and not metadata.is_audio,
            raw_metadata={},
        )


def normalize_avatar_asset(asset: AvatarAsset) -> AvatarAsset:
    """
    Post-process AvatarAsset after normalization.

    Ensures renderer contract is satisfied.
    """
    return AvatarAsset(
        asset_id=asset.asset_id,
        video_path=asset.video_path,
        audio_path=asset.audio_path,
        duration=asset.duration,
        fps=asset.fps,
        width=asset.width,
        height=asset.height,
        codec="h264",
        audio_codec="aac",
        sample_rate=48000,
        has_embedded_audio=asset.has_embedded_audio,
        raw_metadata=asset.raw_metadata,
    )
