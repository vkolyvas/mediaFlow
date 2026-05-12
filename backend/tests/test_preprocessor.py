import pytest
from app.services.preprocessor import cleanup_text


class MockProvider:
    async def generate(self, prompt: str, **kwargs) -> str:
        return '[{"chunk_type": "hook", "content": "test content", "confidence": 0.9}]'


def test_cleanup_text_removes_filler():
    text = "um, so basically like, you know, this is a test uh huh"
    result = cleanup_text(text)
    assert "um" not in result
    assert "like" not in result
    assert "basically" not in result


def test_cleanup_text_preserves_meaning():
    text = "This is a compelling story about growth."
    result = cleanup_text(text)
    assert "compelling" in result
    assert "growth" in result


def test_cleanup_text_normalizes_whitespace():
    text = "Hello    world\n\n  test  "
    result = cleanup_text(text)
    assert "  " not in result
    assert "\n" not in result