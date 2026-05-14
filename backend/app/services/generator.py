import json
import uuid
import aiosqlite
from .preprocessor import cleanup_text, chunk_and_extract
from .ranker import score_draft
from ..ai.base import LLMProvider


def build_linkedin_prompt(template_sections: list[dict], chunks: list[dict]) -> str:
    formatted_chunks = "\n".join(
        f"- [{c['chunk_type']}] {c['content']}" for c in chunks
    )
    sections_prompt = "\n".join(
        f"- **{s['name']}**: {s['prompt']}" for s in template_sections
    )
    return f"""You are a LinkedIn ghostwriter. Write a post using the AIDA format.

Rules:
- Hook in line 1 (stop the scroll)
- Body follows the template structure
- End with a question or CTA
- No AI-sounding language — write like a human
- 150-300 words

Template sections:
{sections_prompt}

Content atoms extracted from the transcript:
{formatted_chunks}"""


def build_x_prompt(chunks: list[dict]) -> str:
    formatted_chunks = "\n".join(
        f"- [{c['chunk_type']}] {c['content']}" for c in chunks
    )
    return f"""You are a Twitter/X thread writer. Create a 5-post thread.

Rules:
- Each post under 280 characters
- Post 1 is the hook (most important)
- Posts should stand alone if someone doesn't follow the thread
- End post 4 with a cliffhanger, post 5 is the payoff/CTA
- Write like a human, not AI

Content:
{formatted_chunks}"""


def build_tiktok_prompt(transcript_summary: str) -> str:
    return f"""You are a TikTok scriptwriter. Create 3 hook variants (3-5 seconds each).

Rules:
- Each hook must start with a pattern interrupt (visual or auditory)
- Under 15 words per hook
- Create curiosity or emotion in the first second
- No setup — dive straight in

Transcript summary:
{transcript_summary}"""


def build_reddit_prompt(chunks: list[dict], subreddit: str = "marketing") -> str:
    formatted_chunks = "\n".join(
        f"- [{c['chunk_type']}] {c['content']}" for c in chunks
    )
    return f"""You are a Reddit post writer. Write a post for the r/{subreddit} community.

Rules:
- Conversational tone, not corporate
- No emoji
- Include a hook in the title
- Body should invite discussion (end with a question)
- 200-500 words

Content:
{formatted_chunks}"""


async def run_generation(
    db: aiosqlite.Connection,
    project_id: str,
    transcript_id: str,
    template_id: str,
    subreddit: str,
    ai: LLMProvider,
    platforms: list[str] | None = None,
) -> tuple[str, list[dict]]:
    import asyncio

    cursor = await db.execute(
        "SELECT raw_text FROM transcripts WHERE id = ?", (transcript_id,)
    )
    row = await cursor.fetchone()
    if not row:
        raise ValueError("Transcript not found")

    raw_text = row[0]
    word_count = len(raw_text.split())
    if word_count > 10000:
        raise ValueError("Transcript too long — max 10,000 words")
    if word_count == 0:
        raise ValueError("Transcript is empty")

    cleaned = cleanup_text(raw_text)

    chunks = chunk_and_extract(cleaned, ai)
    cleaned_text = cleaned[:5000]

    await db.execute(
        "UPDATE transcripts SET cleaned_text = ?, word_count = ? WHERE id = ?",
        (cleaned_text, word_count, transcript_id),
    )

    tid = transcript_id
    for c in chunks:
        import uuid as uid
        cid = str(uid.uuid4())
        await db.execute(
            "INSERT INTO semantic_chunks (id, transcript_id, chunk_type, content, confidence_score) VALUES (?, ?, ?, ?, ?)",
            (cid, tid, c.get("chunk_type", "mixed"), c["content"], c.get("confidence", 0.5)),
        )

    cursor = await db.execute(
        "SELECT structure FROM template_styles WHERE id = ?", (template_id,)
    )
    template_row = await cursor.fetchone()
    if not template_row:
        raise ValueError("Template not found")
    template_structure = json.loads(template_row[0])

    run_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO generation_runs (id, project_id, transcript_id, template_id, status) VALUES (?, ?, ?, ?, ?)",
        (run_id, project_id, transcript_id, template_id, "running"),
    )
    await db.commit()

    def build_post_content(platform: str) -> str:
        if platform == "linkedin":
            return build_linkedin_prompt(template_structure, chunks)
        elif platform == "x":
            return build_x_prompt(chunks)
        elif platform == "tiktok":
            summary = " ".join(c["content"] for c in chunks[:3])
            return build_tiktok_prompt(summary)
        elif platform == "reddit":
            return build_reddit_prompt(chunks, subreddit)
        return ""

    platforms = platforms or ["linkedin", "x", "tiktok", "reddit"]

    async def generate_one(platform: str) -> dict:
        prompt = build_post_content(platform)
        try:
            content = await ai.generate(prompt, max_tokens=2000)
        except Exception as e:
            content = f"[Generation failed: {str(e)}]"

        qs = score_draft(content, template_id, platform)
        pid = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO generated_posts (id, generation_run_id, platform, content, quality_score) VALUES (?, ?, ?, ?, ?)",
            (pid, run_id, platform, content, qs),
        )
        await db.commit()
        return {
            "id": pid,
            "generation_run_id": run_id,
            "platform": platform,
            "content": content,
            "quality_score": qs,
            "reviewed": False,
            "approved": False,
            "edited_content": None,
        }

    results = await asyncio.gather(*[generate_one(p) for p in platforms])

    await db.execute(
        "UPDATE generation_runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
        (run_id,),
    )
    await db.commit()

    return run_id, list(results)