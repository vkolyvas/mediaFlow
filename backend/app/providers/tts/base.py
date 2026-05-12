"""
TTS provider abstraction.

Defines the contract for text-to-speech providers.
Orchestration depends on this interface, not concrete implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable


@dataclass
class TTSResult:
    """Output from a TTS generation call."""
    audio_path: Path
    duration_sec: float
    raw_response_path: Path | None = None
    text: str = ""


@runtime_checkable
class TTSProvider(Protocol):
    """Protocol for TTS providers."""

    async def generate(
        self,
        text: str,
        voice_id: str,
        speed: float = 1.0,
        pitch: float = 0.0,
        volume: float = 1.0,
    ) -> TTSResult:
        """Generate TTS audio from text."""
