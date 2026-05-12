"""
renderer — FFmpeg scene rendering engine.

Public API:
    FFmpegRenderEngine, RenderJob
    render_vertical(), SceneManifest, Scene, CaptionWord
    VIDEO_SPEC, AUDIO_SPEC, CAPTION_SPEC, SAFE_ZONES
    align_audio_to_words(), caption_words_from_segments()
"""

from .engine import FFmpegRenderEngine, RenderJob, render_vertical
from .manifest import SceneManifest, Scene, CaptionWord, Layout, CaptionStyle
from .captions import words_to_ass, apply_karaoke_effect
from .filters import SceneComposer, FilterGraph
from .spec import VIDEO_SPEC, AUDIO_SPEC, CAPTION_SPEC, SAFE_ZONES
from .timing import align_audio_to_words, caption_words_from_segments

__all__ = [
    "FFmpegRenderEngine",
    "RenderJob",
    "render_vertical",
    "SceneManifest",
    "Scene",
    "CaptionWord",
    "Layout",
    "CaptionStyle",
    "SceneComposer",
    "FilterGraph",
    "words_to_ass",
    "apply_karaoke_effect",
    "align_audio_to_words",
    "caption_words_from_segments",
    "VIDEO_SPEC",
    "AUDIO_SPEC",
    "CAPTION_SPEC",
    "SAFE_ZONES",
]
