# WeddingWise — automated demo video pipeline

An end-to-end, fully local pipeline that records the **real** WeddingWise
application and turns it into narrated, branded product videos.

Nothing is simulated: every frame on camera is the actual app driven by
Playwright, and every word of narration is synthesised offline.

```
capture (Playwright + Chromium)  →  narrate (Piper TTS)  →  render (Remotion + FFmpeg)
   real app footage                   .mp3 per scene          1080p30 MP4 + captions
                                              ↓
                              mix (FFmpeg)  →  4 aspect ratios + ragtime bed
```

---

## What it produces

Five independent videos, each a Screen-Studio-style walkthrough of the real
product: title card, smooth cursor, click highlighting, controlled zooms,
on-screen captions and voice narration.

| Video | Scenes | Shows |
| --- | --- | --- |
| `weddingwise-public` | 7 | Landing page, `/planning`, marketplace + live search, vendor public profile, `/for-vendors`, `/for-planners`, planner directory |
| `weddingwise-overview` | 7 | The whole ecosystem in one take — switches identity mid-video to show the public site, then the couple, vendor and planner workspaces |
| `weddingwise-couples` | 9 | Wedding dashboard, details, checklist, budget, calendar, guest list (live filter), day timeline, seating chart, vendor messages |
| `weddingwise-vendors` | 8 | Business OS dashboard, lead pipeline (live filter), financials, requests, clients, reviews, availability calendar, own public profile |
| `weddingwise-planners` | 9 | Dashboard, CRM navigation, sales workspace, client weddings, client workspace, offer pipeline (live refresh), agency, public profile, meetings |

Rendered outputs land in `ultrademo/projects/<project>/out/`:

- `<project>.mp4` — 1920×1080, h264 + aac, 30 fps (YouTube)
- `<project>-vertical.mp4` — 1080×1920, 9:16 reel, full runtime
- `<project>-portrait.mp4` — 1080×1350, 4:5 Instagram feed, ≤ 60 s
- `<project>-square.mp4` — 1080×1080, 1:1 Instagram feed, ≤ 60 s
- `<project>.gif` — social preview (overview only)
- `music.mp3` — the ragtime bed on its own, for editing
- `stems/` — `video.mp4` (no narration), `narration.mp3`, `captions.srt`

These are **gitignored**. Regenerate them with one command.

---

## Layout

```
weddingwise-demo/
├── run-all.sh              # one-command entry point
├── music/                  # ← local: public-domain ragtime beds
│   ├── manifest.json       # track catalogue + which track plays in which video
│   ├── fetch-music.mjs     # download the beds from Wikimedia Commons
│   ├── mix.mjs             # duck the bed under the narration
│   └── CREDITS.md          # provenance and licence for every track
├── scout/                  # exploration tooling (route/selector scouting)
│   ├── scout.mjs           # sign in as a role, dump a page's structure
│   ├── overlays.mjs        # inspect the overlay/banner DOM
│   └── find-music.py       # search Wikimedia Commons for usable music
└── ultrademo/              # vendored upstream pipeline (Apache-2.0)
    ├── capture/            # Playwright capture harness
    ├── tts/                # Piper / ElevenLabs narration
    ├── render/             # Remotion composition
    ├── lib/ww.mjs          # ← local: WeddingWise auth + overlay handling
    ├── projects/<name>/
    │   ├── flow.mjs        # ← local: the shot list for that video
    │   └── assets/         # storyboard.json, captures, audio  (gitignored)
    └── out/                # rendered MP4/GIF/stems             (gitignored)
```

`ultrademo/` is a vendored copy of [new-xp/ultrademo](https://github.com/new-xp/ultrademo)
(see `ultrademo/PROVENANCE.md` for the audit trail and the standing constraints).
Three things are **local modifications** on top of upstream:

- `ultrademo/tts/tts.mjs` — resolves and downloads the Piper voice model
  itself, because Piper ≥ 1.3 dropped `--download-dir` and now requires an
  explicit `.onnx` path for `--model`.
- `ultrademo/lib/ww.mjs` — WeddingWise-specific helpers (below).
- `ultrademo/render/src/` + `ultrademo/scripts/render.mjs` — the four
  delivery formats (16:9, 9:16, 4:5, 1:1) and the feed-length cut (below).

---

## Running it

### Prerequisites

```bash
sudo apt-get install -y ffmpeg python3-pip
pip install piper-tts==1.8.0 --break-system-packages   # offline narration
ln -sf ~/.local/bin/piper /usr/local/bin/piper          # piper must be on PATH
```

The app must be running with the WeddingWise frontend on `:4000` and the
backend API on `:9000`.

### Everything

```bash
./run-all.sh              # seed → capture → narrate → render → social → music
./run-all.sh capture      # re-shoot all footage
./run-all.sh tts          # re-narrate (cached: only edited lines re-synthesise)
./run-all.sh render       # re-render from existing storyboards
./run-all.sh render-vars  # vertical / GIF / stems variants of the overview
./run-all.sh social       # every Instagram/Shorts aspect ratio
./run-all.sh music        # (re)mix the ragtime bed under the finished videos
```

`run-all.sh` re-seeds the demo data first, so a capture is always made against
the same deterministic dataset.

### A single video

```bash
cd ultrademo
npm run capture -- weddingwise-couples-2026-10-30
npm run tts     -- weddingwise-couples-2026-10-30
npm run render  -- weddingwise-couples-2026-10-30
```

---

## The four delivery formats

One capture, every aspect ratio. The Remotion composition crops the 1920×1080
source around each scene's point of interest, so the subject stays in frame
whatever the canvas.

| Composition | Size | Format | Used for |
| --- | --- | --- | --- |
| `Demo` | 1920×1080 | 16:9 | YouTube |
| `DemoVertical` | 1080×1920 | 9:16 | Reels, Shorts, TikTok — full runtime |
| `DemoPortrait` | 1080×1350 | 4:5 | Instagram feed — ≤ 60 s |
| `DemoSquare` | 1080×1080 | 1:1 | Instagram / LinkedIn feed — ≤ 60 s |

```bash
npm run render -- <project> --instagram     # all three social formats
npm run render -- <project> --portrait      # just 4:5
```

**The feed cut.** Instagram rejects feed videos longer than 60 s, so the 4:5
and 1:1 renders are not chopped at a fixed timestamp — they are rendered as a
*highlight reel*: the intro and the outro (which carries the URL) always
survive, and the scenes in between are spread evenly so the cut still reads as
a story. The 9:16 reel keeps the full runtime.

---

## Music

Each video gets a **different** public-domain ragtime piano piece, mixed very
low under the narration (~18 dB down) and ducked further under speech with
ffmpeg's `sidechaincompress`, so the rag only surfaces in the gaps between
lines. The mix runs as a post-process on the finished MP4: the video track is
copied, only the audio is re-encoded.

```bash
cd music
node fetch-music.mjs     # download the beds from Wikimedia Commons
node mix.mjs             # mix them under the rendered videos
```

The beds are chosen in `music/manifest.json`; the provenance and licence of
every track is in [`music/CREDITS.md`](music/CREDITS.md).

---

## How the WeddingWise specifics work

### Demo identities

The videos use seeded demo accounts, so no real customer data is ever recorded.

| Role | Email | Password |
| --- | --- | --- |
| couple | `demo@weddingwise.test` | `DemoPass!2026` |
| vendor | `demo-vendor@weddingwise.test` | `DemoPass!2026` |
| planner | `demo-planner@weddingwise.test` | `DemoPass!2026` |

> These are throwaway credentials for a **local** seeded dev database. They are
> not valid against any deployed environment.

Seeded by the app repo (`auth-weddingwise`):

```bash
node tests/e2e/screenshot-auth.js
node tests/e2e/screenshot-auth-vendor.js
node tests/e2e/screenshot-auth-planner.js
```

### Signing in

The sign-in *form* is flaky against a cold dev server, so `lib/ww.mjs` signs in
through the better-auth API instead — the same path the app's own e2e harness
uses. The session cookie lands in the browser context's cookie jar, so every
later navigation is authenticated.

```js
GET  /api/auth/csrf            → csrf_token cookie
POST /api/auth/sign-in/email   → better-auth.session_token cookie
```

`switchRole()` signs out and back in, which is how the overview video tours
all three sides in a single take.

### Overlay stripping

The app renders three pieces of chrome that are not product: a cookie-consent
bar, an unverified-email warning banner, and a setup-guide widget. They sit on
top of the content, so `lib/ww.mjs` exports `OVERLAY_SCRIPT`, which the flows
inject into every page and which hides all three. It only removes UI — it never
touches app data.

### Route gotchas found while scoping the shots

- Couple sub-pages are **wedding-scoped**: `/my-wedding/<id>/budget`, not
  `/my-wedding/budget` (the latter just redirects).
- The couple's message inbox is **per conversation**: `/messages/<id>`;
  `/messages` on its own redirects to the wedding picker.
- The planner CRM is `/planner/inbox`, not `/planner/leads`.
- `/my-wedding/<id>/financial` and `/my-wedding/<id>/vendors` are empty or
  error for the seeded couple, so they are not in any shot list.

---

## Narration

`en_US-lessac-medium` via Piper, fully offline. The narration for each scene is
cached by a hash of (engine, voice, script), so editing one line re-synthesises
only that line.

Piper emits no word-level timings, so captions are static. Setting
`ELEVENLABS_API_KEY` in `ultrademo/.env` switches to ElevenLabs and yields
per-word karaoke captions plus a more natural voice.

---

## Licensing

`ultrademo/` is Apache-2.0 but depends on **Remotion**, which is free only for
individuals and for companies with ≤ 3 employees. A larger employer needs a
Remotion Company License before using these videos for client-facing assets.
