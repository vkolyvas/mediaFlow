"""
Media inspector — extracts metadata from audio/video files using ffprobe.

Used to determine:
- codec
- resolution
- duration
- FPS
- audio format
- bitrate

Before normalization, you MUST know what you're normalizing.
"""

import json
import subprocess
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class MediaMetadata:
    """
    Canonical metadata extracted from any media file via ffprobe.

    All values are normalized to canonical spec units.
    """
    path: str
    format_name: str
    duration: float
    size_bytes: int
    bitrate: int
    # Video fields
    codec_name: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    pixel_format: Optional[str] = None
    # Audio fields
    audio_codec: Optional[str] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
    audio_bitrate: Optional[int] = None
    # Container-level
    is_video: bool = False
    is_audio: bool = False

    def needs_normalization(self, target_width: int, target_height: int, target_fps: int) -> bool:
        return (
            self.width != target_width
            or self.height != target_height
            or (self.fps and abs(self.fps - target_fps) > 0.1)
            or self.codec_name not in ("h264", "hevc")
        )


class MediaInspector:
    """
    Wraps ffprobe for media metadata extraction.

    Requires ffprobe to be installed.
    """

    @staticmethod
    def inspect(path: str) -> MediaMetadata:
        """
        Extract all available metadata from a media file.

        Returns MediaMetadata. Raises FileNotFoundError if ffprobe missing
        or file doesn't exist.
        """
        if not os.path.exists(path):
            raise FileNotFoundError(f"Media file not found: {path}")

        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise ValueError(f"ffprobe failed for {path}: {result.stderr}")

        data = json.loads(result.stdout)
        return MediaInspector._parse(data, path)

    @staticmethod
    def _parse(data: dict, path: str) -> MediaMetadata:
        streams = data.get("streams", [])
        fmt = data.get("format", {})

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

        fps = None
        if video_stream:
            fps_str = video_stream.get("r_frame_rate", "0/1")
            if "/" in fps_str:
                num, den = fps_str.split("/")
                fps = float(num) / float(den) if float(den) != 0 else 0.0
            else:
                fps = float(fps_str)

        metadata = MediaMetadata(
            path=path,
            format_name=fmt.get("format_name", ""),
            duration=float(fmt.get("duration", 0.0)),
            size_bytes=int(fmt.get("size", 0)),
            bitrate=int(fmt.get("bit_rate", 0)),
            codec_name=video_stream.get("codec_name") if video_stream else None,
            width=video_stream.get("width") if video_stream else None,
            height=video_stream.get("height") if video_stream else None,
            fps=fps,
            pixel_format=video_stream.get("pix_fmt") if video_stream else None,
            audio_codec=audio_stream.get("codec_name") if audio_stream else None,
            sample_rate=audio_stream.get("sample_rate") if audio_stream else None,
            channels=audio_stream.get("channels") if audio_stream else None,
            audio_bitrate=audio_stream.get("bit_rate") if audio_stream else None,
            is_video=video_stream is not None,
            is_audio=audio_stream is not None,
        )

        return metadata
