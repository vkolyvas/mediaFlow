"""
Tests for caption timing engine.
"""

import pytest
from app.renderer import CaptionWord, caption_words_from_segments


class TestCaptionWord:
    def test_caption_word_fields(self):
        w = CaptionWord(word="Hello", start=0.0, end=0.5, emphasis=False)
        assert w.word == "Hello"
        assert w.start == 0.0
        assert w.end == 0.5
        assert w.emphasis is False


class TestFallbackCaptionTiming:
    def test_caption_words_from_segments_basic(self):
        segments = [
            {"text": "Hello world", "start": 0.0, "end": 1.0},
        ]
        words = caption_words_from_segments(segments, audio_duration=1.0)
        assert len(words) == 2
        assert words[0].word == "Hello"
        assert words[1].word == "world"
        assert words[0].start < words[0].end
        assert words[1].start < words[1].end

    def test_caption_words_from_segments_sequential(self):
        """Word timestamps should be monotonically increasing."""
        segments = [
            {"text": "one two three", "start": 0.0, "end": 2.0},
        ]
        words = caption_words_from_segments(segments, audio_duration=2.0)
        assert len(words) == 3
        for i in range(len(words) - 1):
            assert words[i].end <= words[i + 1].start

    def test_caption_words_from_segments_empty(self):
        segments = []
        words = caption_words_from_segments(segments, audio_duration=1.0)
        assert len(words) == 0

    def test_caption_words_respect_duration(self):
        segments = [
            {"text": "hi", "start": 0.0, "end": 0.5},
        ]
        words = caption_words_from_segments(segments, audio_duration=0.5)
        # Total word time should not exceed audio duration
        total = sum(w.end - w.start for w in words)
        assert total <= 0.5
