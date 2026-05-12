"""
Pipeline state machine — tracks lifecycle of a generation job.

States progress forward only. No backwards transitions.
"""

from enum import Enum, auto


class PipelineState(Enum):
    """
    Lifecycle states for a generation pipeline run.

    Transitions:
        CREATED → SCRIPT_GENERATED → TTS_GENERATED → ASSETS_READY → CAPTIONS_ALIGNED → RENDERING → COMPLETED
                                                                    ↓
                                                                FAILED
    """
    CREATED = auto()          # Pipeline initialized, context prepared
    SCRIPT_GENERATED = auto() # Script text generated from transcript
    TTS_GENERATED = auto()    # TTS audio generated from script
    ASSETS_READY = auto()    # Avatar video + audio normalized
    CAPTIONS_ALIGNED = auto() # Word timestamps from Whisper alignment
    RENDERING = auto()        # FFmpeg rendering in progress
    COMPLETED = auto()        # Final MP4 produced
    FAILED = auto()           # Any stage failed

    def can_transition_to(self, next_state: "PipelineState") -> bool:
        """Check if transition is valid (forward only, no skipping)."""
        if self == PipelineState.FAILED:
            return False
        if next_state == PipelineState.FAILED:
            return True
        return next_state.value > self.value

    def is_terminal(self) -> bool:
        """True if this state ends the pipeline."""
        return self in (PipelineState.COMPLETED, PipelineState.FAILED)
