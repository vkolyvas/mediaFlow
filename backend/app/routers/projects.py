import uuid
from fastapi import APIRouter, Depends, HTTPException
import aiosqlite

from ..db import get_db
from ..models import ProjectCreate, ProjectResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse)
async def create_project(body: ProjectCreate, db: aiosqlite.Connection = Depends(get_db)):
    id = str(uuid.uuid4())
    cursor = await db.execute(
        "INSERT INTO projects (id, name) VALUES (?, ?)",
        (id, body.name),
    )
    await db.commit()
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (id,))
    row = await cursor.fetchone()
    return ProjectResponse(
        id=row["id"], name=row["name"], created_at=row["created_at"]
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=row["id"], name=row["name"], created_at=row["created_at"]
    )