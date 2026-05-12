import aiosqlite
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db, seed_templates
from .routers import projects, transcripts, templates, generate, posts
from .api.routes import generate_router, jobs_router

app = FastAPI(title="mediaFlow")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3040"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(transcripts.router)
app.include_router(templates.router)
app.include_router(generate.router)
app.include_router(posts.router)
app.include_router(generate_router)
app.include_router(jobs_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("startup")
async def startup():
    await init_db()
    async with aiosqlite.connect("mediaflow.db") as db:
        await seed_templates(db)