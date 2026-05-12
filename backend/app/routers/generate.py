from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..db import get_db
from ..models import GenerateRequest, GenerationRunResponse, PostResponse
from ..services.generator import run_generation
from ..ai.anthropic import AnthropicClaudeProvider
from ..config import settings

router = APIRouter(prefix="/api/generate", tags=["generate"])


def get_ai_provider() -> AnthropicClaudeProvider:
    api_key = settings.anthropic_api_key
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")
    return AnthropicClaudeProvider(api_key)


@router.post("", response_model=GenerationRunResponse)
async def generate(
    body: GenerateRequest,
    db: aiosqlite.Connection = Depends(get_db),
):
    ai = get_ai_provider()
    try:
        run_id, posts = await run_generation(
            db=db,
            project_id=body.project_id,
            transcript_id=body.transcript_id,
            template_id=body.template_id,
            subreddit=body.subreddit or "marketing",
            ai=ai,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    return GenerationRunResponse(run_id=run_id, status="completed", posts=posts)