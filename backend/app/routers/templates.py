import json
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..db import get_db
from ..models import TemplateResponse, TemplateSection

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateResponse])
async def list_templates(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM template_styles")
    rows = await cursor.fetchall()
    return [
        TemplateResponse(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            structure=[TemplateSection(**s) for s in json.loads(row["structure"])],
        )
        for row in rows
    ]


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM template_styles WHERE id = ?", (template_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateResponse(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        structure=[TemplateSection(**s) for s in json.loads(row["structure"])],
    )