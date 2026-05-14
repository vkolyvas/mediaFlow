# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mediaFlow is a synchronous content repurposing pipeline — paste a transcript, select a template, and generate platform-ready draft posts for LinkedIn, X, TikTok, and Reddit simultaneously.

Stack: Next.js 15 (frontend) + FastAPI (backend) + SQLite (aiosqlite) + Claude API + MiniMax (via OpenAI compat layer)

## Ports

- **Frontend**: http://localhost:3040
- **Backend API**: http://127.0.0.1:8040

The frontend proxies `/api/*` → `http://127.0.0.1:8040/api/*` via `next.config.js` rewrites. All API calls from the frontend go through this proxy.

## Run Commands

```bash
# Backend (from /projects/mediaFlow/backend)
uvicorn app.main:app --host 127.0.0.1 --port 8040

# Frontend (from /projects/mediaFlow/frontend)
npm run build && npm run start
# or for dev with hot reload:
npm run dev

# Run backend tests
cd backend && pytest

# Run a single test file
cd backend && pytest tests/test_preprocessor.py
```

## Architecture

### Frontend
- `frontend/app/page.tsx` — Dashboard, creates projects and redirects
- `frontend/app/project/[id]/page.tsx` — Project view: paste transcript, select template/platforms, generate
- `frontend/app/review/[id]/page.tsx` — Review grid: edit, approve/reject drafts
- `frontend/components/TemplateSelector.tsx` — Template grid with hover tooltips (archetype, example, best-for)
- `frontend/lib/api.ts` — Fetch wrapper; `BASE = process.env.NEXT_PUBLIC_API_URL || "/api"`

### Backend
- `backend/app/main.py` — FastAPI app, CORS (allows localhost:3040), lifespan (DB init + template seed + job recovery)
- `backend/app/db.py` — SQLite schema init (`init_db`) and template seeding (`seed_templates`)
- `backend/app/routers/` — API route modules: `projects`, `transcripts`, `templates`, `generate`, `posts`
- `backend/app/pipeline/` — Generation pipeline with job recovery on startup (`PipelineOrchestrator`, `PipelineJob`, `PipelineState`)
- `backend/app/services/preprocessor.py` — One-pass cleanup + chunking + semantic extraction
- `backend/app/services/generator.py` — Orchestrates per-platform generation using selected template
- `backend/app/services/ranker.py` — Heuristic quality scoring (no extra AI call)
- `backend/app/ai/` — LLM provider abstraction: `AnthropicClaudeProvider`, `OpenAIProvider` (MiniMax compat)
- `backend/app/config.py` — Settings via pydantic-settings; `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`

### Database
SQLite with tables: `projects`, `transcripts`, `semantic_chunks`, `template_styles` (seeded on startup), `generation_runs`, `generated_posts`.

7 seeded templates: AIDA, PAS, Story, Credibility, Contrast, Slippery Slide, Transformation.

## Key Design Decisions

- **Synchronous**: No Redis/RQ/async workers — everything runs in-process
- **No embeddings in MVP**: Semantic search deferred to v2
- **No Reddit OAuth**: MVP generates draft text only, no posting
- **Heuristic scoring**: Quality score is rule-based, no extra AI call
- **Job recovery**: On startup, `recover_incomplete_jobs()` resumes any interrupted pipeline jobs from storage

## Environment Variables

```
ANTHROPIC_API_KEY=     # Primary AI provider
OPENAI_API_KEY=        # For MiniMax via OpenAI compat
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimax.io/v1
DEFAULT_MODEL=claude-sonnet-4-20250514
MAX_TOKENS_PER_CALL=2000
```