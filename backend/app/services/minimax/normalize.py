"""
Video/audio normalization pipeline.

Ensures all media assets conform to the canonical spec before rendering:
- codec: h264 / aac
- resolution: 1080x1920
- fps: 30
- audio: aac / 48000 / stereo

This is the single mandatory preprocessing step before any asset enters the renderer.
"""

import os
import subprocess
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .inspector import MediaInspector, MediaMetadata
from .exceptions import AssetNormalizationError

CANONICAL_VIDEO_SPEC = {
    "codec": "h264",
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "pixel_format": "yuv420p",
}

CANONICAL_AUDIO_SPEC = {
    "codec": "aac",
    "sample_rate": 48000,
    "channels": 2,
    "bitrate": "192k",
}


@dataclass
class NormalizedAsset:
    """
    Result of normalizing an asset to canonical spec.

    The renderer ONLY receives assets in canonical format.
    """
    original_path: str
    normalized_path: str
    checksum: str
    metadata: MediaMetadata
    was_normalized: bool


def _compute_checksum(path: str) -> str:
    """MD5 hash of file for cache key."""
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            md5.update(chunk)
    return md5.hexdigest()


def normalize_video_asset(
    input_path: str,
    output_dir: str,
    target_width: int = CANONICAL_VIDEO_SPEC["width"],
    target_height: int = CANONICAL_VIDEO_SPEC["height"],
    target_fps: int = CANONICAL_VIDEO_SPEC["fps"],
    overwrite: bool = False,
) -> NormalizedAsset:
    """
    Normalize a video asset to canonical spec via FFmpeg.

    Steps:
    1. Inspect input metadata
    2. If already canonical, hard-link or copy
    3. Otherwise, re-encode with FFmpeg

    Returns NormalizedAsset with normalized_path.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    metadata = MediaInspector.inspect(input_path)
    os.makedirs(output_dir, exist_ok=True)

    # Check if normalization is needed
    needs_norm = (
        metadata.width != target_width
        or metadata.height != target_height
        or (metadata.fps and abs(metadata.fps - target_fps) > 0.1)
        or metadata.codec_name not in ("h264", "hevc", "h265")
    )

    base = Path(input_path).stem
    suffix = Path(input_path).suffix
    normalized_path = os.path.join(output_dir, f"{base}_normalized.mp4")

    if os.path.exists(normalized_path) and not overwrite:
        return NormalizedAsset(
            original_path=input_path,
            normalized_path=normalized_path,
            checksum=_compute_checksum(normalized_path),
            metadata=metadata,
            was_normalized=True,
        )

    if not needs_norm and metadata.codec_name == "h264":
        # Already canonical — copy
        import shutil
        shutil.copy2(input_path, normalized_path)
        return NormalizedAsset(
            original_path=input_path,
            normalized_path=normalized_path,
            checksum=_compute_checksum(normalized_path),
            metadata=metadata,
            was_normalized=False,
        )

    # Re-encode to canonical spec
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-vf", f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height},setsar=1:1",
        "-r", str(target_fps),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ar", "48000",
        "-ac", "2",
        "-movflags", "+faststart",
        normalized_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise AssetNormalizationError(f"FFmpeg normalization failed: {result.stderr}")

    # Re-inspect normalized file
    normalized_meta = MediaInspector.inspect(normalized_path)

    return NormalizedAsset(
        original_path=input_path,
        normalized_path=normalized_path,
        checksum=_compute_checksum(normalized_path),
        metadata=normalized_meta,
        was_normalized=True,
    )


def normalize_audio_asset(
    input_path: str,
    output_dir: str,
    target_sample_rate: int = CANONICAL_AUDIO_SPEC["sample_rate"],
    target_channels: int = CANONICAL_AUDIO_SPEC["channels"],
    overwrite: bool = False,
) -> NormalizedAsset:
    """
    Normalize an audio asset to canonical spec.
    """
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    metadata = MediaInspector.inspect(input_path)
    os.makedirs(output_dir, exist_ok=True)

    base = Path(input_path).stem
    normalized_path = os.path.join(output_dir, f"{base}_audio_normalized.aac")

    if os.path.exists(normalized_path) and not overwrite:
        return NormalizedAsset(
            original_path=input_path,
            normalized_path=normalized_path,
            checksum=_compute_checksum(normalized_path),
            metadata=metadata,
            was_normalized=True,
        )

    needs_norm = (
        metadata.sample_rate != target_sample_rate
        or metadata.channels != target_channels
        or metadata.audio_codec != "aac"
    )

    if not needs_norm:
        import shutil
        shutil.copy2(input_path, normalized_path)
        return NormalizedAsset(
            original_path=input_path,
            normalized_path=normalized_path,
            checksum=_compute_checksum(normalized_path),
            metadata=metadata,
            was_normalized=False,
        )

    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", input_path,
        "-c:a", "aac",
        "-ar", str(target_sample_rate),
        "-ac", str(target_channels),
        "-b:a", "192k",
        normalized_path,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise AssetNormalizationError(f"Audio normalization failed: {result.stderr}")

    normalized_meta = MediaInspector.inspect(normalized_path)

    return NormalizedAsset(
        original_path=input_path,
        normalized_path=normalized_path,
        checksum=_compute_checksum(normalized_path),
        metadata=normalized_meta,
        was_normalized=True,
    )
