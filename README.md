<p align="center">
  <img src="assets/mediaFlow.svg" style="width: 60%; height: auto;">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3-000?logo=next.js&style=for-the-badge" alt="Next.js 15">
  <img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&style=for-the-badge" alt="FastAPI">
  <img src="https://img.shields.io/badge/Python-3.11+-blue.svg?style=for-the-badge" alt="Python 3.11+">
  <img src="https://img.shields.io/badge/SQLite-aiosqlite-003545?logo=sqlite&style=for-the-badge" alt="SQLite">
  <img src="https://img.shields.io/badge/AI-Claude+MiniMax-8b5cf6?style=for-the-badge" alt="Claude + MiniMax">
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/vasiliskolyvasmsc" target="_blank"><img src="https://img.shields.io/badge/LinkedIn-Vasilis%20Kolyvas-0077b5?logo=linkedin&style=for-the-badge" alt="LinkedIn"></a>
  <a href="https://github.com/vkolyvas/mediaFlow" target="_blank"><img src="https://img.shields.io/badge/GitHub-mediaFlow-24292e?logo=github&style=for-the-badge" alt="GitHub"></a>
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License">
</p>

<p align="center">
  <strong>Synchronous content repurposing pipeline — paste a transcript, select a template, and generate platform-ready draft posts for LinkedIn, X, TikTok, and Reddit simultaneously.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a>
  ·
  <a href="#architecture">Architecture</a>
  ·
  <a href="#templates">Templates</a>
  ·
  <a href="#api">API</a>
  ·
  <a href="#contributing">Contributing</a>
</p>

---

## What Is This?

mediaFlow transforms long-form transcripts into platform-optimized content across multiple channels in a single pass. Paste your transcript, pick a template style, and get draft posts for LinkedIn, X, TikTok, and Reddit — ready to review and publish.

- **One-pass preprocessing** — cleanup, chunking, and semantic extraction in a single AI call
- **7 template styles** — AIDA, PAS, Story, Credibility, Contrast, Slippery Slide, Transformation
- **4 platforms** — LinkedIn, X/Twitter, TikTok, Reddit (drafts only in MVP)
- **Job recovery** — interrupted generations resume on restart
- **Local-first** — SQLite database, no external services required

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Anthropic API key (`ANTHROPIC_API_KEY`)

### Backend

```bash
cd backend
pip install -e .
uvicorn app.main:app --host 127.0.0.1 --port 8040
```

### Frontend

```bash
cd frontend
npm install
npm run build && npm run start
# Opens at http://localhost:3040
```

### Generate Content

1. Open http://localhost:3040
2. Click **New Project**
3. Paste a transcript
4. Select a template style
5. Choose target platforms
6. Click **Generate**
7. Review and approve drafts at the review page

---

## Architecture

```
                  ┌─────────────────────┐
                  │   Next.js Frontend  │
                  │   (port 3040)       │
                  └──────────┬──────────┘
                             │ /api/* proxy
                             ▼
                  ┌─────────────────────┐
                  │   FastAPI Backend   │
                  │   (port 8040)       │
                  └──┬──────┬──────┬───┘
                     │      │      │
              ┌──────┘      │      └──────┐
              ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Pipeline │  │ Templates│  │  Posts   │
        │Orchestrator│ │  Router  │  │  Router  │
        └─────┬────┘  └──────────┘  └──────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐    ┌──────────┐
│Preprocessor│   │ Generator │
│ (one-pass) │   │(per-platform)|
└──────────┘    └─────┬────┘
                      │
              ┌───────┴───────┐
              ▼       ▼       ▼
         ┌────────┐ ┌────┐ ┌─────┐
         │LinkedIn│ │ X  │ │TikTok│
         └────────┘ └────┘ └─────┘
```

- **Preprocessor** — one AI call for cleanup + chunking + semantic extraction
- **Generator** — per-platform generation using selected template structure
- **Ranker** — heuristic quality scoring (no extra AI call)
- **PipelineOrchestrator** — coordinates generation, handles job recovery

---

## Templates

| Template | Archetype | Best For |
|---------|-----------|----------|
| **AIDA** | Attention → Interest → Desire → Action | Sales, launch, direct response |
| **PAS** | Problem → Agitate → Solve | Persuasion, behavior change |
| **Story** | Once upon a time → conflict → resolution | Emotional engagement, memorability |
| **Credibility** | Expert quote + practical tips | Educational authority, B2B trust |
| **Contrast** | Don't → Do comparisons | Educational clarity, positioning |
| **Slippery Slide** | Ultra-short hook + open loop | Virality, hook optimization |
| **Transformation** | Humble beginning → success | Personal branding, founder narratives |

Each template has sections (e.g., Hook, Body, CTA) that guide the generation. Template metadata includes archetype, example, and best-for tags displayed as hover tooltips.

---

## API

All API calls from the frontend go through a proxy (`/api/*` → `http://127.0.0.1:8040/api/*`).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get project |
| `GET` | `/api/templates` | List all 7 templates |
| `POST` | `/api/transcripts` | Create transcript |
| `POST` | `/api/generate` | Run generation pipeline |
| `GET` | `/api/posts?generation_run_id=X` | List generated posts |
| `PATCH` | `/api/posts/:id` | Edit post content |
| `POST` | `/api/posts/:id/approve` | Approve post |
| `POST` | `/api/posts/:id/reject` | Reject post |

---

## Environment Variables

```bash
ANTHROPIC_API_KEY=     # Primary AI provider
OPENAI_API_KEY=        # For MiniMax via OpenAI compat
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimax.io/v1
DEFAULT_MODEL=claude-sonnet-4-20250514
MAX_TOKENS_PER_CALL=2000
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push and open a Pull Request

---

## License

MIT