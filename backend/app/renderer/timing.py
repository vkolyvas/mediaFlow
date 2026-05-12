"""
Caption timing engine — aligns TTS audio with word timestamps using Whisper.

Pipeline:
  Script text → TTS audio → Faster-Whisper alignment → word timestamps → CaptionWord[]

This is the correct production approach: align AFTER TTS generation,
not infer from TTS timing (which is inaccurate due to pauses/emotion).
"""

from pathlib import Path
from typing import Optional

from .manifest import CaptionWord

# Lazy import to avoid hard dependency when not using caption timing
_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
    return _whisper_model


def align_audio_to_words(
    audio_path: str,
    reference_text: str,
    model_size: str = "base",
) -> list[CaptionWord]:
    """
    Align TTS audio with the reference text using Whisper.

    Returns word-level timestamps as CaptionWord objects.

    Args:
        audio_path: Path to the TTS-generated audio file (WAV/MP3)
        reference_text: The script text that was used to generate the audio
        model_size: faster-whisper model to use (tiny/base/small/medium)

    Returns:
        List of CaptionWord with word, start, end, emphasis
    """
    model = _get_whisper_model()

    segments, info = model.transcribe(audio_path, word_timestamps=True, language="en")

    words = []
    for segment in segments:
        if segment.words:
            for word in segment.words:
                words.append(
                    CaptionWord(
                        word=word.word.strip(),
                        start=word.start,
                        end=word.end,
                        emphasis=False,
                    )
                )
        else:
            words.append(
                CaptionWord(
                    word=segment.text.strip(),
                    start=segment.start,
                    end=segment.end,
                    emphasis=False,
                )
            )

    return _boost_emphasis(words, reference_text)


def _boost_emphasis(words: list[CaptionWord], reference_text: str) -> list[CaptionWord]:
    """
    Mark punch words as emphasized based on reference text patterns.

    Patterns: words in caps, short punchy words, exclamation-adjacent words.
    """
    punch_indicators = {
        "you", "know", "think", "actually", "here's", "the", "thing",
        "real", "truth", "right", "now", "wait", "listen", "look",
        "imagine", "believe", "exactly", "finally", "never",
    }

    emphasized = []
    ref_lower = reference_text.lower()
    ref_words = ref_lower.split()

    for word in words:
        w_lower = word.word.lower().strip(".,!?'\"")
        is_punch = (
            w_lower in punch_indicators
            or (len(w_lower) <= 4 and w_lower in ref_words)
        )
        word.emphasis = is_punch
        emphasized.append(word)

    return emphasized


def caption_words_from_segments(
    segments: list[dict],
    audio_duration: float,
) -> list[CaptionWord]:
    """
    Fallback: generate evenly-spaced caption words from segment text.

    Used when audio alignment fails but we still need captions.
    """
    all_words = []
    current_time = 0.0
    avg_word_duration = audio_duration / max(sum(len(s.get("text", "").split()) for s in segments), 1)

    for segment in segments:
        text = segment.get("text", "")
        words_in_segment = text.split()
        segment_duration = len(words_in_segment) * avg_word_duration

        for word in words_in_segment:
            word_duration = avg_word_duration
            all_words.append(
                CaptionWord(
                    word=word,
                    start=current_time,
                    end=current_time + word_duration,
                    emphasis=False,
                )
            )
            current_time += word_duration

    return all_words
