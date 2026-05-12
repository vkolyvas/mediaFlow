"""
Tests for MiniMax orchestration layer.
"""

import pytest
import os
from app.services.minimax import (
    MiniMaxClient,
    MiniMaxCapabilities,
    AvatarJobStatus,
    TTSJobStatus,
    AvatarAsset,
    MediaInspector,
    MediaMetadata,
    normalize_video_asset,
    NormalizedAsset,
    JobStorage,
    PollingConfig,
    poll_until_done,
    MiniMaxAPIError,
    AssetNormalizationError,
)
from app.services.minimax.adapters import MiniMaxAdapter


class TestMiniMaxCapabilities:
    def test_defaults(self):
        caps = MiniMaxCapabilities()
        assert caps.max_video_duration_seconds == 30.0
        assert caps.supports_async_jobs is True
        assert "mp4" in caps.supported_video_formats


class TestAvatarAsset:
    def test_avatar_asset_defaults(self):
        asset = AvatarAsset(
            asset_id="test123",
            video_path="/path/to/video.mp4",
            audio_path=None,
            duration=15.0,
            fps=30,
            width=1920,
            height=1080,
        )
        assert asset.asset_id == "test123"
        assert asset.has_embedded_audio is True
        assert asset.codec == "h264"
        assert asset.audio_codec == "aac"


class TestMediaMetadata:
    def test_needs_normalization_true(self):
        meta = MediaMetadata(
            path="/test.mp4",
            format_name="mp4",
            duration=10.0,
            size_bytes=1_000_000,
            bitrate=1_000_000,
            codec_name="h264",
            width=1920,
            height=1080,
            fps=30.0,
            is_video=True,
        )
        # Same as canonical — no normalization needed
        assert meta.needs_normalization(1920, 1080, 30) is False

    def test_needs_normalization_true_for_mismatch(self):
        meta = MediaMetadata(
            path="/test.webm",
            format_name="webm",
            duration=10.0,
            size_bytes=1_000_000,
            bitrate=1_000_000,
            codec_name="vp9",
            width=1280,
            height=720,
            fps=24.0,
            is_video=True,
        )
        assert meta.needs_normalization(1920, 1080, 30) is True


class TestJobStorage:
    def test_job_dir_creation(self, tmp_path):
        storage = JobStorage(root=str(tmp_path))
        job_dir = storage.job_dir("abc123")
        assert job_dir == tmp_path / "jobs" / "abc123"

    def test_subdirs_created(self, tmp_path):
        storage = JobStorage(root=str(tmp_path))
        job_id = "test_job"
        raw = storage.raw_dir(job_id)
        norm = storage.normalized_dir(job_id)
        caps = storage.captions_dir(job_id)
        renders = storage.renders_dir(job_id)

        assert raw.exists()
        assert norm.exists()
        assert caps.exists()
        assert renders.exists()

    def test_path_for(self, tmp_path):
        storage = JobStorage(root=str(tmp_path))
        path = storage.path_for("job1", "raw", "video.mp4")
        assert path == str(tmp_path / "jobs" / "job1" / "raw" / "video.mp4")

    def test_store_and_retrieve_raw(self, tmp_path):
        storage = JobStorage(root=str(tmp_path))
        job_id = "store_test"
        content = b"fake video bytes"
        stored = storage.store_raw(job_id, "video.mp4", content)

        assert os.path.exists(stored)
        assert open(stored, "rb").read() == content

    def test_cleanup(self, tmp_path):
        storage = JobStorage(root=str(tmp_path))
        job_id = "cleanup_test"
        storage.raw_dir(job_id)
        assert storage.exists(job_id)
        storage.cleanup(job_id)
        assert not storage.exists(job_id)


class TestPollingConfig:
    def test_backoff_multiplier(self):
        cfg = PollingConfig(initial_interval=2.0, max_interval=30.0, backoff_multiplier=1.5)
        assert cfg.next_interval(2.0) == 3.0
        assert cfg.next_interval(3.0) == 4.5
        assert cfg.next_interval(10.0) == 15.0
        assert cfg.next_interval(25.0) == 30.0  # capped at max

    def test_custom_config(self):
        cfg = PollingConfig(initial_interval=1.0, timeout=60.0, max_attempts=10)
        assert cfg.initial_interval == 1.0
        assert cfg.timeout == 60.0
        assert cfg.max_attempts == 10


class TestMiniMaxAdapter:
    def test_from_metadata(self):
        meta = MediaMetadata(
            path="/video.mp4",
            format_name="mp4",
            duration=15.0,
            size_bytes=5_000_000,
            bitrate=2_000_000,
            codec_name="h264",
            width=1920,
            height=1080,
            fps=30.0,
            is_video=True,
        )
        asset = MiniMaxAdapter.from_metadata(meta, "asset123")
        assert asset.asset_id == "asset123"
        assert asset.video_path == "/video.mp4"
        assert asset.duration == 15.0
        assert asset.fps == 30
        assert asset.codec == "h264"
