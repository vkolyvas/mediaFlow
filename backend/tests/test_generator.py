import pytest
from app.services.ranker import score_draft


def test_score_draft_linkedin_good_length():
    content = " ".join(["word"] * 200)
    score = score_draft(content, "aida", "linkedin")
    assert 0.5 < score <= 1.0


def test_score_draft_linkedin_too_short():
    content = "short"
    score = score_draft(content, "aida", "linkedin")
    assert score == 0.5


def test_score_draft_cta_bonus():
    content = "What do you think about this? Share your thoughts!"
    score = score_draft(content, "pas", "linkedin")
    assert score > 0.5


def test_score_draft_story_bonus():
    content = "Once upon a time there was a developer who learned to code."
    score = score_draft(content, "story", "linkedin")
    assert score > 0.5


def test_score_draft_returns_float():
    content = "normal content here " * 20
    score = score_draft(content, "pas", "linkedin")
    assert isinstance(score, float)
    assert 0.0 <= score <= 1.0