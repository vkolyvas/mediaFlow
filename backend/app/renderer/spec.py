"""
Canonical internal video specification for mediaFlow.

All assets entering the renderer MUST normalize to this standard.
"""

VIDEO_SPEC = {
    "container": "mp4",
    "codec": "h264",
    "resolution": {"width": 1080, "height": 1920},
    "fps": 30,
    "pixel_format": "yuv420p",
    "bitrate": "8M",
    "audio": {
        "codec": "aac",
        "sample_rate": 48000,
        "bitrate": "192k",
        "channels": 2,
    },
}

AUDIO_SPEC = {
    "codec": "aac",
    "sample_rate": 48000,
    "bitrate": "192k",
    "channels": 2,
}

CAPTION_SPEC = {
    "format": "ass",
    "font": "Arial",
    "font_size": 48,
    "bold": True,
    "color": "&H00FFFFFF",
    "outline": 2,
    "shadow": 1,
}

SAFE_ZONES = {
    "left": 0.05,
    "right": 0.05,
    "top": 0.08,
    "bottom": 0.12,
}
