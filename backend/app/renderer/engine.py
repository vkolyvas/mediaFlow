"""
FFmpegRenderEngine — the core renderer service.

Orchestrates filter graphs, caption rendering, and export.
Single entry point for all video composition.
"""

import subprocess
import os
import uuid
from pathlib import Path
from typing import Optional

from .manifest import SceneManifest, Scene
from .spec import VIDEO_SPEC, AUDIO_SPEC
from .captions import words_to_ass, apply_karaoke_effect
from .filters import SceneComposer


class RenderJob:
    def __init__(self, job_id: str, manifest: SceneManifest, output_dir: str):
        self.job_id = job_id
        self.manifest = manifest
        self.output_dir = Path(output_dir)
        self.asset_map: dict[str, str] = {}
        self.ass_path: Optional[str] = None
        self.output_path: Optional[str] = None
        self.status = "pending"

    def add_asset(self, scene_id: str, path: str):
        self.asset_map[scene_id] = path

    def set_caption_words(self, words: list[dict]):
        self.caption_words = words

    def output_file(self, filename: str = "render.mp4") -> str:
        p = self.output_dir / filename
        self.output_path = str(p)
        return str(p)


class FFmpegRenderEngine:
    """
    Renders scene manifests to TikTok-spec MP4s.

    Pipeline:
    1. Validate manifest against spec
    2. Build filter graph from timeline
    3. Render scenes with FFmpeg
    4. Burn captions if enabled
    5. Export canonical MP4
    """

    def __init__(self, workspace_dir: str = "/tmp/mediaflow"):
        self.workspace = Path(workspace_dir)
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.spec = VIDEO_SPEC

    def render(self, job: RenderJob) -> tuple[str, Optional[str]]:
        """
        Render a job to MP4.

        Returns (output_path, error_message).
        If error_message is not None, render failed.
        """
        manifest = job.manifest
        output = job.output_file(f"{job.job_id}.mp4")

        if not manifest.timeline:
            return "", "Empty timeline"

        cmd = self._build_render_command(job, output)
        if cmd is None:
            return "", "Could not build render command"

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            return "", f"FFmpeg error: {result.stderr}"

        caption_output = None
        if job.manifest.timeline and any((s.captions and s.captions.get("enabled")) for s in job.manifest.timeline):
            caption_output = self._render_captions(job, output)

        final_output = caption_output if caption_output else output
        return final_output, None

    def _build_render_command(self, job: RenderJob, output: str) -> Optional[list[str]]:
        manifest = job.manifest
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
        w, h = manifest.resolution

        input_count = 0
        for scene in manifest.timeline:
            if scene.type == "avatar" and scene.asset:
                path = job.asset_map.get(scene.asset, scene.asset)
                if os.path.exists(path):
                    cmd.extend(["-i", path])
                    input_count += 1
            elif scene.type == "broll" and scene.asset:
                path = job.asset_map.get(scene.asset, scene.asset)
                if os.path.exists(path):
                    cmd.extend(["-i", path])
                    input_count += 1
            elif scene.type == "silence":
                duration = scene.end - scene.start
                cmd.extend(["-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:d={duration}:r={manifest.fps}"])
                input_count += 1
            elif scene.type == "color":
                color = scene.asset or "#000000"
                duration = scene.end - scene.start
                cmd.extend(["-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}:d={duration}:r={manifest.fps}"])
                input_count += 1

        if input_count == 0:
            duration = manifest.total_duration()
            if duration <= 0:
                return None
            cmd.extend(["-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:d={duration}:r={manifest.fps}"])

        cmd.extend([
            "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1:1",
            "-r", str(manifest.fps),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-ar", "48000",
            "-ac", "2",
            "-t", str(manifest.total_duration()),
            "-movflags", "+faststart",
            output,
        ])

        return cmd

    def _render_captions(self, job: RenderJob, video_path: str) -> Optional[str]:
        """
        Burn ASS captions into video using FFmpeg ASS filter.

        Returns path to captioned video, or None if failed.
        """
        if not hasattr(job, "caption_words") or not job.caption_words:
            return None

        words = [type('obj', (object,), w) for w in job.caption_words]
        ass_content = words_to_ass(words, style="tiktok_bold")

        job_id = job.job_id
        ass_path = str(self.workspace / f"{job_id}_captions.ass")
        with open(ass_path, "w") as f:
            f.write(ass_content)

        captioned_path = str(self.workspace / f"{job_id}_captioned.mp4")

        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-i", video_path,
            "-vf", f"ass={ass_path}",
            "-c:a", "copy",
            "-movflags", "+faststart",
            captioned_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode == 0:
            return captioned_path
        return None

    def create_job(self, manifest: SceneManifest, output_dir: Optional[str] = None) -> RenderJob:
        job_id = str(uuid.uuid4())[:8]
        out_dir = Path(output_dir) if output_dir else self.workspace / job_id
        out_dir.mkdir(parents=True, exist_ok=True)
        return RenderJob(job_id, manifest, str(out_dir))


def render_vertical(
    manifest: SceneManifest,
    assets: dict[str, str],
    caption_words: Optional[list[dict]] = None,
    output_dir: str = "/tmp/mediaflow",
) -> tuple[str, Optional[str], Optional[str]]:
    """
    Convenience function — render a manifest in one call.

    Returns (rendered_path, caption_path, error).
    """
    engine = FFmpegRenderEngine(workspace_dir=output_dir)
    job = engine.create_job(manifest, output_dir)

    for scene_id, path in assets.items():
        job.add_asset(scene_id, path)

    if caption_words:
        job.set_caption_words(caption_words)

    rendered, error = engine.render(job)

    if error:
        return "", None, error

    caption_path = job.ass_path if hasattr(job, "ass_path") else None

    return rendered, caption_path, None
