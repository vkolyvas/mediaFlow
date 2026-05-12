"""
Provider exceptions.
"""


class ProviderError(Exception):
    """Base exception for provider errors."""
    pass


class TTSError(ProviderError):
    """TTS generation failed."""
    pass


class MiniMaxProviderError(ProviderError):
    """MiniMax API error."""
    pass
