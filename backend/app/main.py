import aiosqlite
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db, seed_templates
from .routers import projects, transcripts, templates, generate, posts
from .api.routes import generate_router, jobs_router
from .pipeline.orchestrator import PipelineOrchestrator


logger = logging.getLogger(__name__)


async def recover_incomplete_jobs() -> None:
    """
    Scan storage for jobs with nonterminal states and resume them.

    Called on startup so that deploy/restart does not lose active work.
    """
    orchestrator = PipelineOrchestrator()
    repo = orchestrator.repo

    # List all job directories under storage root
    storage_root = repo.root
    if not storage_root.exists():
        return

    recovered = 0
    for job_dir in storage_root.iterdir():
        if not job_dir.is_dir():
            continue
        job_id = job_dir.name
        try:
            job = await repo.load_job(job_id)
        except Exception:
            continue

        if job.state.name in ("COMPLETED", "FAILED", "CREATED"):
            # CREATED means never started — skip (will start fresh)
            # COMPLETED/FAILED are terminal — skip
            continue

        logger.info(f"Recovering incomplete job: {job_id} state={job.state.name}")
        try:
            await orchestrator.resume_job(job_id)
            recovered += 1
        except Exception as e:
            logger.error(f"Failed to recover job {job_id}: {e}")

    if recovered:
        logger.info(f"Recovered {recovered} incomplete jobs")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    async with aiosqlite.connect("mediaflow.db") as db:
        await seed_templates(db)

    # Recover any jobs interrupted by previous shutdown
    await recover_incomplete_jobs()

    yield

    # Shutdown (nothing to clean up currently)


app = FastAPI(title="mediaFlow", lifespan=lifespan)

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