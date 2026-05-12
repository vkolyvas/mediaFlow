"""
MiniMax service exceptions.
"""


class MiniMaxError(Exception):
    """Base exception for MiniMax service errors."""
    pass


class MiniMaxAPIError(MiniMaxError):
    def __init__(self, message: str, status_code: int = 0, error_code: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code


class MiniMaxTimeoutError(MiniMaxError):
    """Job polling timed out."""
    pass


class MiniMaxRateLimitError(MiniMaxError):
    """Rate limit exceeded."""
    pass


class AssetNormalizationError(MiniMaxError):
    """FFmpeg normalization failed."""
    pass
