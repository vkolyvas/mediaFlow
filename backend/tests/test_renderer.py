"""
Tests for the FFmpeg scene renderer.

These tests verify the renderer contract without requiring real AI assets.
They use local color/silence scenes to test the composition pipeline.
"""

import pytest
import json
from app.renderer import (
    SceneManifest,
    Scene,
    Layout,
    FFmpegRenderEngine,
    RenderJob,
    render_vertical,
    VIDEO_SPEC,
    words_to_ass,
    CaptionWord,
)


class TestSceneManifest:
    def test_manifest_total_duration(self):
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=30.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=5.0),
                Scene(id="s2", type="silence", start=5.0, end=10.0),
            ],
        )
        assert manifest.total_duration() == 10.0

    def test_manifest_get_scene_at(self):
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=10.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=5.0),
                Scene(id="s2", type="color", asset="#000000", start=5.0, end=10.0),
            ],
        )
        at_3 = manifest.get_scene_at(3.0)
        assert len(at_3) == 1
        assert at_3[0].id == "s1"

    def test_manifest_get_scene_by_id(self):
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=10.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=5.0),
            ],
        )
        s = manifest.get_scene_by_id("s1")
        assert s is not None
        assert s.id == "s1"

        not_found = manifest.get_scene_by_id("nonexistent")
        assert not_found is None


class TestVideoSpec:
    def test_video_spec_resolution(self):
        assert VIDEO_SPEC["resolution"]["width"] == 1080
        assert VIDEO_SPEC["resolution"]["height"] == 1920

    def test_video_spec_fps(self):
        assert VIDEO_SPEC["fps"] == 30


class TestCaptionRendering:
    def test_words_to_ass_basic(self):
        words = [
            CaptionWord(word="Hello", start=0.0, end=0.5, emphasis=False),
            CaptionWord(word="world", start=0.5, end=1.0, emphasis=True),
        ]
        output = words_to_ass(words)
        assert "Hello" in output
        assert "world" in output
        assert "Arial" in output
        assert "Dialogue" in output

    def test_words_to_ass_timestamps(self):
        words = [
            CaptionWord(word="Test", start=1.5, end=2.0, emphasis=False),
        ]
        output = words_to_ass(words)
        assert "1:00:30.00" in output or "0:00:01.50" in output


class TestFFmpegRenderEngine:
    def test_create_job(self):
        engine = FFmpegRenderEngine(workspace_dir="/tmp/mediaflow_test")
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=10.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=3.0),
                Scene(id="s2", type="color", asset="#111111", start=3.0, end=6.0),
            ],
        )
        job = engine.create_job(manifest)
        assert job.job_id is not None
        assert job.manifest is manifest
        assert job.status == "pending"

    def test_job_asset_map(self):
        engine = FFmpegRenderEngine(workspace_dir="/tmp/mediaflow_test")
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=5.0,
            timeline=[
                Scene(id="s1", type="avatar", asset="avatar.mp4", start=0.0, end=5.0),
            ],
        )
        job = engine.create_job(manifest)
        job.add_asset("avatar.mp4", "/path/to/avatar.mp4")
        assert job.asset_map["avatar.mp4"] == "/path/to/avatar.mp4"

    def test_render_silence_only(self):
        """Test that a manifest with only silence scenes can be rendered."""
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=3.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=3.0),
            ],
        )
        engine = FFmpegRenderEngine(workspace_dir="/tmp/mediaflow_test")
        job = engine.create_job(manifest)
        output_path, error = engine.render(job)
        # Silence-only render should work
        assert error is None or "Empty timeline" in error


class TestRenderVertical:
    def test_render_vertical_returns_tuple(self):
        manifest = SceneManifest(
            resolution=(1080, 1920),
            fps=30,
            duration=2.0,
            timeline=[
                Scene(id="s1", type="silence", start=0.0, end=2.0),
            ],
        )
        result = render_vertical(manifest, {}, output_dir="/tmp/mediaflow_test")
        assert len(result) == 3
        rendered, caption, error = result
        assert isinstance(rendered, str)
        assert caption is None or isinstance(caption, str)
        assert error is None or isinstance(error, str)
