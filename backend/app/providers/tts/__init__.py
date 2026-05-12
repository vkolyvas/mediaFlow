"""
TTS provider public API.
"""

from .base import TTSProvider, TTSResult
from .minimax import MiniMaxTTSProvider

__all__ = [
    "TTSProvider",
    "TTSResult",
    "MiniMaxTTSProvider",
]
