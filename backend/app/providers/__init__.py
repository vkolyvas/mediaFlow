"""
Provider abstractions for external AI services.

providers/
  tts/           — Text-to-speech providers
"""

from .tts import TTSProvider, TTSResult, MiniMaxTTSProvider

__all__ = [
    "TTSProvider",
    "TTSResult",
    "MiniMaxTTSProvider",
]
