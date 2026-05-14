import json
import re
from ..ai.base import LLMProvider
from typing import Optional


FILLER_WORDS = re.compile(r"\b(um|uh|like|you know|basically|actually|so\s+|right\s+){1,}\b", re.I)


def cleanup_text(text: str) -> str:
    text = FILLER_WORDS.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


async def chunk_and_extract(cleaned_text: str, ai: LLMProvider) -> list[dict]:
    prompt = f"""You are a content analyst. Process this transcript in one pass.

TASK:
1. Fix sentence boundaries and remove filler words (um, uh, like, you know)
2. Split into semantic chunks grouped by topic/theme
3. For each chunk, identify: type (hook/claim/story/data/question/cta), content, confidence

OUTPUT FORMAT (JSON array only, no markdown):
[
  {{"chunk_type": "hook", "content": "...", "confidence": 0.9}},
  {{"chunk_type": "claim", "content": "...", "confidence": 0.85}},
  ...
]

TRANSCRIPT:
{cleaned_text}"""

    try:
        result = await ai.generate(prompt, max_tokens=2048)
    except Exception:
        return [{"chunk_type": "mixed", "content": cleaned_text, "confidence": 0.5}]

    try:
        data = json.loads(result)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass

    return [{"chunk_type": "mixed", "content": cleaned_text, "confidence": 0.5}]