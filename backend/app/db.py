import aiosqlite
import os
from .config import settings

DATABASE_PATH = os.environ.get("DATABASE_PATH", "mediaflow.db")


async def get_db():
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id),
                raw_text TEXT NOT NULL,
                cleaned_text TEXT,
                word_count INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS semantic_chunks (
                id TEXT PRIMARY KEY,
                transcript_id TEXT REFERENCES transcripts(id),
                chunk_type TEXT,
                content TEXT NOT NULL,
                confidence_score FLOAT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS template_styles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                structure TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS generation_runs (
                id TEXT PRIMARY KEY,
                project_id TEXT REFERENCES projects(id),
                transcript_id TEXT REFERENCES transcripts(id),
                template_id TEXT REFERENCES template_styles(id),
                status TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now')),
                completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS generated_posts (
                id TEXT PRIMARY KEY,
                generation_run_id TEXT REFERENCES generation_runs(id),
                platform TEXT NOT NULL,
                content TEXT NOT NULL,
                quality_score FLOAT,
                reviewed INTEGER DEFAULT 0,
                approved INTEGER DEFAULT 0,
                edited_content TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
        """)
        await db.commit()


async def seed_templates(db: aiosqlite.Connection):
    templates = [
        {
            "id": "aida",
            "name": "AIDA",
            "description": "Attention → Interest → Desire → Action",
            "structure": [
                {"name": "Attention", "prompt": "Start with a bold statement or question that stops the scroll."},
                {"name": "Interest", "prompt": "Build curiosity with specific details or a relatable scenario."},
                {"name": "Desire", "prompt": "Show the transformation or benefit clearly."},
                {"name": "Action", "prompt": "End with a clear CTA or thought-provoking question."},
            ],
        },
        {
            "id": "pas",
            "name": "PAS",
            "description": "Problem → Agitate → Solve",
            "structure": [
                {"name": "Problem", "prompt": "Open with the pain point your audience relates to."},
                {"name": "Agitate", "prompt": "Dig into why this problem persists and worsens."},
                {"name": "Solution", "prompt": "Present your solution or insight as the answer."},
            ],
        },
        {
            "id": "story",
            "name": "Story",
            "description": "Once upon a time → conflict → resolution",
            "structure": [
                {"name": "Setup", "prompt": "Paint a vivid picture of the starting situation."},
                {"name": "Conflict", "prompt": "Introduce the challenge, struggle, or turning point."},
                {"name": "Resolution", "prompt": "Show how it ended and what was learned or gained."},
            ],
        },
        {
            "id": "credibility",
            "name": "Credibility",
            "description": "Expert quote + practical tips",
            "structure": [
                {"name": "Hook", "prompt": "Lead with a bold claim or surprising statistic from the transcript."},
                {"name": "Expert Voice", "prompt": "Present the insight in the expert's own words when possible."},
                {"name": "Tips", "prompt": "Break down practical, actionable takeaways."},
            ],
        },
        {
            "id": "contrast",
            "name": "Contrast",
            "description": "Don't → Do comparisons",
            "structure": [
                {"name": "Wrong Way", "prompt": "Show the common mistake or misconception (the Don't)."},
                {"name": "Right Way", "prompt": "Reveal what actually works (the Do)."},
                {"name": "Outcome", "prompt": "Paint the positive result of doing it right."},
            ],
        },
        {
            "id": "slippery_slide",
            "name": "Slippery Slide",
            "description": "Ultra-short opening sentences that hook instantly",
            "structure": [
                {"name": "Hook", "prompt": "One punchy, pattern-interrupting sentence that creates curiosity."},
                {"name": "Support", "prompt": "Follow up with a second sentence that deepens the intrigue."},
                {"name": "Payoff", "prompt": "Deliver the insight or resolution in the third sentence."},
            ],
        },
        {
            "id": "transformation",
            "name": "Transformation",
            "description": "Humble beginning → success",
            "structure": [
                {"name": "Before", "prompt": "Start with a humble, relatable beginning."},
                {"name": "Journey", "prompt": "Show the struggle and key decisions along the way."},
                {"name": "After", "prompt": "Reveal the outcome and what it taught."},
            ],
        },
    ]

    for t in templates:
        import json
        await db.execute(
            """
            INSERT OR IGNORE INTO template_styles (id, name, description, structure)
            VALUES (?, ?, ?, ?)
            """,
            (t["id"], t["name"], t["description"], json.dumps(t["structure"])),
        )
    await db.commit()