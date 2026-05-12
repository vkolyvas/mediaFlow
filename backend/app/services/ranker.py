import json
import re


def score_draft(content: str, template_id: str, platform: str) -> float:
    score = 0.5
    word_count = len(content.split())

    if platform == "linkedin":
        if 150 <= word_count <= 300:
            score += 0.15
    elif platform == "x":
        if len(content) <= 280 * 5:
            score += 0.15
    elif platform == "tiktok":
        if word_count < 50:
            score += 0.15

    if any(q in content.lower() for q in ["?", "what do you", "share", "tell me", "what's your"]):
        score += 0.15

    cl = content.lower()
    if template_id == "story" and "once upon" in cl:
        score += 0.1
    elif template_id == "pas" and any(w in cl for w in ["problem", "struggle", "challenge"]):
        score += 0.1
    elif template_id == "aida" and any(w in cl for w in ["attention", "imagine", "what if"]):
        score += 0.1

    return min(score, 1.0)