"""
GenerationContext — the cross-stage state container.

This is the single source of truth for any generation run.
All pipeline stages read from and write to this object.

Renderer sees ONLY SceneManifest + normalized assets.
PipelineOrchestrator manages all other state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING

from ..personas import Persona
from ..renderer.manifest import SceneManifest, CaptionWord
from .states import PipelineState

if TYPE_CHECKING:
    from ..repositories.jobs.error import PipelineError


@dataclass
class StateTransition:
    """Logged state transition for debugging and recovery."""
    from_state: PipelineState
    to_state: PipelineState
    timestamp: float
    error: Optional[str] = None


@dataclass
class GenerationContext:
    """
    Canonical state container for a generation run.

    Every stage of the pipeline operates on this object.
    No stage should need to look up state from another source.

    Renderer receives ONLY render_manifest + normalized assets.
    All other state is pipeline-internal.

    Fields:
        job_id:           Unique identifier for this run
        persona:          Persona configuration (source of generation truth)
        transcript:       Raw input transcript
        script:           Generated script text
        hook_variant:     Selected hook variant

        voice_asset:      Path to TTS audio file
        avatar_asset:     Path to avatar video file

        captions:         Word-level timestamps from alignment
        render_manifest:  SceneManifest for FFmpeg composition

        error:            Error message if FAILED

    Artifacts:
        Centralized index of all artifact paths produced by this run.
        Keys: raw_response, audio, normalized_audio, captions, render, etc.
    """
    job_id: str
    persona: Persona
    transcript: str = ""

    # Script generation output
    script: Optional[str] = None
    hook_variant: Optional[str] = None

    # Asset paths
    voice_asset: Optional[str] = None
    avatar_asset: Optional[str] = None

    # Caption timing
    captions: list[CaptionWord] = field(default_factory=list)

    # Renderer input
    render_manifest: Optional[SceneManifest] = None

    # Final output
    output_path: Optional[str] = None

    # Error state
    error: Optional[str] = None

    # Artifact index: stage name -> path
    artifacts: dict = field(default_factory=dict)

    # State transition log
    transition_log: list[StateTransition] = field(default_factory=list)

    # Structured error from last failure (stored as dict, deserialized at runtime)
    last_error: Optional[dict] = None

    # Schema version for migrations
    context_version: int = 1

    def is_failed(self) -> bool:
        return self.error is not None

    def get_caption_words(self) -> list[dict]:
        """Serialize CaptionWord list for renderer."""
        return [
            {"word": w.word, "start": w.start, "end": w.end, "emphasis": w.emphasis}
            for w in self.captions
        ]

    def log_transition(self, from_state: PipelineState, to_state: PipelineState, timestamp: float, error: Optional[str] = None):
        self.transition_log.append(StateTransition(
            from_state=from_state,
            to_state=to_state,
            timestamp=timestamp,
            error=error,
        ))
