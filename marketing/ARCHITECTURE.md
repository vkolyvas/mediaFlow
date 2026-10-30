# Architecture

## The shape

The engine is a set of small scripts over one SQLite file. There is no
server, no queue and no background worker: each command does one thing,
reads the state of the pipeline out of the database and writes it back.

```
automation/            the scripts - one per command
lib/                   the engine
  config.mjs             paths, env, brand tokens, pillars, audiences
  db.mjs                 the schema and every query
  state.mjs              the content lifecycle
  ww-api.mjs             the read-only WeddingWise client
  demo-filter.mjs        the demo-record exclusion
  seo-pages.mjs          the landing-page vocabulary
  research.mjs           what to write about this week
  prompts.mjs            the system prompt and the per-pillar rules
  llm.mjs                the Anthropic call
  validate.mjs           the anti-fabrication gate
  dedupe.mjs             fingerprints and caption similarity
  utm.mjs                the campaign naming scheme
  metrics.mjs            provider-agnostic metric normalisation
  time.mjs               timezone-aware scheduling
  postiz.mjs             the Postiz CLI wrapper
```

## The data model

| Table | Holds |
| --- | --- |
| `campaigns` | one row per concept: pillar, audience, objective, place, category, landing page, UTM campaign, planned date |
| `posts` | one row per post: caption, hashtags, script, media, visual brief, vendor references, state, fingerprint, Postiz id |
| `post_events` | every state change, with who did it and why |
| `vendor_snapshots` | the vendor facts a post was allowed to use, and when they were captured |
| `metrics` | one performance snapshot per post per day |
| `conversions` | registrations and enquiries, attributed to a campaign and a post |

Two design points:

**The campaign is the join key.** The UTM campaign string is written into
`campaigns` once and never rewritten. It is what comes back on the landing
page, and it is what ties a registration to a post. Everything else in the
attribution - the platform, the fingerprint - is secondary.

**The vendor snapshot is the provenance.** When a post names a vendor, the
vendor's name, rating, review count and claim status are stored. The
validator re-fetches the listing and compares. If a rating changed, if a
vendor became claimed, or if the listing disappeared between generation and
approval, the post fails. This is what makes "the caption was true when it was
written" checkable rather than assumed.

## The pipeline

### 1. Calendar (`build-calendar.mjs`)

Reads the weekday plan from `strategy/calendar-config.json`, and for each day
and each audience picks a place and a category that have inventory. A concept
becomes two posts - Instagram and Facebook - in the `IDEA` state.

The place and category are chosen by a **coverage rule, not a ranking**: a
place is interesting to write about when it has enough listings to make a
useful page. That is the same threshold the site's own SEO uses, so a post
never links to a thin page.

The two audiences get different places. Greek couples get the whole market,
largest first. International couples get the Greek islands and coastal towns
that a destination wedding would happen in. Without that split, both streams
wrote about the same thing in two languages.

### 2. Research and generation (`generate-content.mjs`)

For each concept, the engine reads the live listings for that place and
category, saves a vendor snapshot of each one it intends to use, and makes
one Anthropic call with a data block that contains nothing else. The model
may only use the facts in that block.

One call produces both platform variants, because the difference between them
is the platform, not the content.

### 3. Validation (`validate-content.mjs`)

The gate. It fails a post for any of eighteen reasons - a fabricated rating,
a superlative attached to a named vendor, an implied endorsement of an
unclaimed vendor, a link that does not resolve, a landing page that does not
exist, a near-duplicate of something already scheduled, a caption that is
not in the right language. The full list is in `lib/validate.mjs`.

A failing post goes to `FAILED` with the reason recorded. It never reaches a
human, because a human's attention is the scarce resource in this pipeline.

### 4. Approval (`approve-content.mjs`)

A human. The post is printed in full - caption, hashtags, link, slides, shot
list, visual brief, and every vendor used with its rating and whether it is
claimed. Approve or reject; the file moves to `content/approved/` or
`content/rejected/`.

### 5. Scheduling (`schedule-content.mjs`)

Only `APPROVED` posts. The slot is computed in Europe/Athens and converted to
UTC, DST-safe. Media is uploaded to Postiz first, because Instagram and
Facebook only accept URLs Postiz has verified. The post is scheduled, never
published immediately - an immediate post would slip past the approval.

### 6. Measurement (`collect-analytics.mjs`, `collect-conversions.mjs`)

Postiz gives the reach side: `metrics`. The app gives the outcome side:
`conversions`, pulled from the internal endpoint that the UTM capture branch
exposes.

### 7. The report (`report.mjs`)

Follows the funnel and answers the five questions. The recommendation in
section 5 is computed from the data, not written by hand - the pillar with
the best conversion per engagement gets more, the pillars that reached people
and produced no registration get a different call to action rather than more
of the same, and the reach pillar stays in the calendar even when it
converts badly.

## The decisions, and why

**Node's standard library, no framework.** `node:sqlite` for the database,
`fetch` for the API, `--test` for the tests. The engine has one runtime
dependency (the Postiz CLI). A marketing pipeline that needs a database server
and a queue to run is a marketing pipeline that does not get run.

**The WeddingWise app is read through its public API, not its database.** The
app is a separate repository with its own migrations. Reading its database
would couple the two deployments and put write access to production in the
content engine. The only write we need - attributing a conversion - is a
narrow, read-only endpoint in the app repo.

**The content is generated, the facts are not.** The model writes captions.
It does not decide what is true. The facts come from the API, are frozen into
a snapshot, and are checked against the live listing before approval. This is
the difference between "an LLM wrote a post" and "a post that can be
published".

**One approval, two platforms.** Approval is per post, not per platform pair.
The Instagram and Facebook variants of a concept are generated together and
approved together, because they say the same thing.

**Duplicates are caught twice.** A fingerprint catches the same concept
generated twice. Caption similarity catches the same idea written twice with
different words. Both are needed: the fingerprint misses rephrasing, and the
similarity check catches it.

**The demo records are excluded at the source.** The production database still
contains the demo seed rows, with fabricated ratings and stock-photography
galleries. `lib/demo-filter.mjs` removes them from every read, using three
independent signals so a change to the seed set does not open a hole. This
is a data-hygiene problem in the app repo that the filter papers over; it
should be fixed there.

## The constraints this design keeps

- Nothing reaches a social channel without a human approving it.
- No automated DMs, on any platform.
- No vendor photography is republished.
- No superlative ranking without a defensible method - and there is none, so
  there are no rankings.
- No scraped content, no unsolicited bulk email.
- Every published link carries a UTM campaign, so the outcome is measurable.
