"""
Caption renderer — generates ASS format subtitles from word-level timestamps.

TikTok captions use behavioral word-level emphasis, not static subtitles.
"""

from .manifest import CaptionWord


def words_to_ass(words: list[CaptionWord], style: str = "tiktok_bold") -> str:
    """
    Convert word-level timestamps to ASS subtitle format.

    Supports karaoke-style progression and punch-word highlighting.
    """
    lines = []
    lines.append("[Script Info]")
    lines.append("Title: mediaFlow captions")
    lines.append("ScriptType: v4.00+")
    lines.append("Collisions: Normal")
    lines.append("PlayDepth: 0")
    lines.append("")
    lines.append("[V4+ Styles]")
    lines.append("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding")
    lines.append(f"Style: {style},Arial,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,150,1")
    lines.append("")
    lines.append("[Events]")
    lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    for i, word in enumerate(words):
        start = _ts_to_ass(word.start)
        end = _ts_to_ass(word.end)
        text = _escape_ass(word.word)

        if word.emphasis:
            effect = "\\fscx150\\fscy150"
        else:
            effect = ""

        lines.append(f"Dialogue: 0,{start},{end},{style},,0,0,0,{effect},{text}")

    return "\n".join(lines)


def _ts_to_ass(seconds: float) -> str:
    """Convert decimal seconds to ASS timestamp format (H:MM:SS.CC)."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _escape_ass(text: str) -> str:
    text = text.replace("\\", "\\\\")
    text = text.replace("{", "\\{")
    text = text.replace("}", "\\}")
    return text


def apply_karaoke_effect(words: list[CaptionWord]) -> str:
    """
    Generate karaoke-style line-by-line progression.

    Used for animated caption reveal — shows one word at a time.
    Returns ASS event lines with karaoke effect.
    """
    lines = []
    for word in words:
        start = _ts_to_ass(word.start)
        end = _ts_to_ass(word.end)
        text = _escape_ass(word.word)
        effect = "\\kf" + str(int((word.end - word.start) * 1000)) if word.emphasis else ""
        lines.append(f"Dialogue: 0,{start},{end},tiktok_bold,,0,0,0,{effect},{text}")
    return "\n".join(lines)
