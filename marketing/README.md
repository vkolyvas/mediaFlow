# WeddingWise marketing engine

An acquisition engine, not a content calendar.

Social posts are the top of a funnel whose bottom is a couple registering on
WeddingWise and then contacting a vendor. Everything in this directory
exists to move that funnel, and every post carries a link to the most
specific page that has real inventory.

```
WeddingWise API ──▶ calendar ──▶ content ──▶ validation ──▶ approval
     (read-only)                                    (a human)      │
                                                                       ▼
      weekly report ◀── conversions ◀── attribution   Postiz ──▶ Instagram
            │              (app repo)                                Facebook
            └──▶ next week's plan
```

## Quick start

```bash
cd marketing
npm install
cp .env.example .env      # fill in ANTHROPIC_API_KEY, POSTIZ_API_KEY, ...
npm test                  # 92 tests, no network, no database needed
npm run calendar          # 30 days of concepts, two posts each
npm run status            # where everything stands
```

The full loop, once Postiz and the API keys are in place:

```bash
npm run generate          # ideas -> captions, scripts, visual briefs
npm run validate          # the anti-fabrication gate
npm run approve           # a human decides
npm run schedule          # Postiz publishes at the planned local time
npm run collect           # metrics from Postiz
npm run collect-conversions  # registrations and enquiries from the app
npm run report            # the weekly report
```

## The commands

| Command | What it does |
| --- | --- |
| `npm run calendar` | Builds the concepts for the next 30 days: one per day per audience, two posts each (Instagram + Facebook). |
| `npm run generate` | One LLM call per concept. Reads live vendor data, writes the caption, hashtags, CTA, reel script, slides, shot list and visual brief. |
| `npm run validate` | Checks every generated post against the live listings and the anti-fabrication rules. A post that fails never reaches a human. |
| `npm run approve` | The approval gate. Prints a post in full - caption, link, slides, vendors used with their ratings and claim status - and waits for a decision. |
| `npm run schedule` | Sends approved posts to Postiz. Uploads the media first, because Instagram rejects any URL Postiz has not verified. |
| `npm run collect` | Pulls the performance of every published post into the `metrics` table. |
| `npm run collect-conversions` | Pulls registrations and enquiries from the app and attributes them to the campaign that produced them. |
| `npm run report` | The weekly report. Answers the five questions in `strategy/acquisition-strategy.md`. |
| `npm run status` | The queue by state, what needs a human, and whether tracking is working. |

## What is in here

```
brand/         the brand, the voice, the visual rules
strategy/      audiences, pillars, the acquisition strategy, the calendar config
content/       drafts, approved, rejected - the JSON of every post
campaigns/     one file per campaign
analytics/     weekly reports, validation logs
assets/        rendered media (gitignored)
infra/postiz/  the self-hosted Postiz stack
lib/           the engine
automation/    the scripts the commands above run
tests/         92 tests
```

## The three rules

The engine exists to make one thing impossible: publishing something false
about a real business.

1. **Only what the data says.** Every vendor fact in a caption comes from a
   snapshot of the live listing, and the validator re-fetches that listing
   before a human sees the post. No invented names, ratings, prices or
   availability.
2. **No fabricated rankings.** "5 photographers to discover in Athens" is
   allowed. "The top 5 photographers in Athens" is not - we have no defensible
   method for it.
3. **No implied endorsement.** A vendor who has not claimed their profile is a
   listing, not a partner, and the copy says so.

A validator enforces all three, and a human approves everything. See
`brand/brand-guidelines.md` for the reasoning.

## The documents

| Document | What it answers |
| --- | --- |
| `ARCHITECTURE.md` | How the engine is put together and why |
| `ENV.md` | Every environment variable and where it comes from |
| `DEPLOYMENT.md` | Running it for real: Postiz, cron, the app-side branch |
| `brand/brand-guidelines.md` | Colours, type, the logo, the three restrictions |
| `brand/tone-of-voice.md` | What we say and what we do not say |
| `brand/visual-guidelines.md` | Formats, the reel structure, the photography rule |
| `strategy/audience-personas.md` | The two audiences and the vendor side |
| `strategy/content-pillars.md` | The five pillars and the weekly shape |
| `strategy/acquisition-strategy.md` | The funnel, the attribution, the weekly loop |
| `infra/postiz/README.md` | The self-hosted Postiz, and its AGPL obligations |

## The state machine

```
IDEA -> GENERATED -> VALIDATED -> APPROVED -> SCHEDULED -> PUBLISHED
                       |            |           |
                       +--> FAILED +--> FAILED +--> FAILED
```

`FAILED` is reachable from anywhere. `REJECTED` is terminal. Nothing can be
scheduled without passing through `APPROVED` - the scheduler enforces it, it
is not a convention.

## Cost

Node's standard library, `node:sqlite`, and one HTTP call to the Anthropic
API per concept. No database server, no queue, no cloud dependency beyond
Postiz and the API itself.
