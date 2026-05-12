import uuid
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..db import get_db
from ..models import TranscriptCreate, TranscriptResponse, ChunkResponse

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])


@router.post("", response_model=TranscriptResponse)
async def create_transcript(body: TranscriptCreate, db: aiosqlite.Connection = Depends(get_db)):
    id = str(uuid.uuid4())
    word_count = len(body.raw_text.split())
    await db.execute(
        "INSERT INTO transcripts (id, project_id, raw_text, word_count) VALUES (?, ?, ?, ?)",
        (id, body.project_id, body.raw_text, word_count),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM transcripts WHERE id = ?", (id,))
    row = await cursor.fetchone()
    return TranscriptResponse(
        id=row["id"],
        project_id=row["project_id"],
        raw_text=row["raw_text"],
        cleaned_text=row["cleaned_text"],
        word_count=row["word_count"],
        created_at=row["created_at"],
    )


@router.get("/{transcript_id}", response_model=TranscriptResponse)
async def get_transcript(transcript_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM transcripts WHERE id = ?", (transcript_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return TranscriptResponse(
        id=row["id"],
        project_id=row["project_id"],
        raw_text=row["raw_text"],
        cleaned_text=row["cleaned_text"],
        word_count=row["word_count"],
        created_at=row["created_at"],
    )


@router.get("/{transcript_id}/chunks", response_model=list[ChunkResponse])
async def get_chunks(transcript_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM semantic_chunks WHERE transcript_id = ?", (transcript_id,)
    )
    rows = await cursor.fetchall()
    return [
        ChunkResponse(
            id=row["id"],
            transcript_id=row["transcript_id"],
            chunk_type=row["chunk_type"],
            content=row["content"],
            confidence_score=row["confidence_score"],
        )
        for row in rows
    ]