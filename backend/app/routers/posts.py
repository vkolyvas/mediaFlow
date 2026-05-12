from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..db import get_db
from ..models import PostResponse, PostEdit

router = APIRouter(prefix="/api/posts", tags=["posts"])


@router.get("", response_model=list[PostResponse])
async def list_posts(generation_run_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute(
        "SELECT * FROM generated_posts WHERE generation_run_id = ?", (generation_run_id,)
    )
    rows = await cursor.fetchall()
    return [
        PostResponse(
            id=row["id"],
            generation_run_id=row["generation_run_id"],
            platform=row["platform"],
            content=row["content"],
            quality_score=row["quality_score"],
            reviewed=bool(row["reviewed"]),
            approved=bool(row["approved"]),
            edited_content=row["edited_content"],
        )
        for row in rows
    ]


@router.patch("/{post_id}", response_model=PostResponse)
async def edit_post(post_id: str, body: PostEdit, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "UPDATE generated_posts SET edited_content = ?, reviewed = 1 WHERE id = ?",
        (body.edited_content, post_id),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM generated_posts WHERE id = ?", (post_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostResponse(
        id=row["id"],
        generation_run_id=row["generation_run_id"],
        platform=row["platform"],
        content=row["edited_content"] or row["content"],
        quality_score=row["quality_score"],
        reviewed=bool(row["reviewed"]),
        approved=bool(row["approved"]),
        edited_content=row["edited_content"],
    )


@router.post("/{post_id}/approve", response_model=PostResponse)
async def approve_post(post_id: str, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "UPDATE generated_posts SET approved = 1, reviewed = 1 WHERE id = ?",
        (post_id,),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM generated_posts WHERE id = ?", (post_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostResponse(
        id=row["id"],
        generation_run_id=row["generation_run_id"],
        platform=row["platform"],
        content=row["edited_content"] or row["content"],
        quality_score=row["quality_score"],
        reviewed=bool(row["reviewed"]),
        approved=bool(row["approved"]),
        edited_content=row["edited_content"],
    )


@router.post("/{post_id}/reject", response_model=PostResponse)
async def reject_post(post_id: str, db: aiosqlite.Connection = Depends(get_db)):
    await db.execute(
        "UPDATE generated_posts SET approved = 0, reviewed = 1 WHERE id = ?",
        (post_id,),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM generated_posts WHERE id = ?", (post_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return PostResponse(
        id=row["id"],
        generation_run_id=row["generation_run_id"],
        platform=row["platform"],
        content=row["edited_content"] or row["content"],
        quality_score=row["quality_score"],
        reviewed=bool(row["reviewed"]),
        approved=bool(row["approved"]),
        edited_content=row["edited_content"],
    )