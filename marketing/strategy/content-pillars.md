# Content pillars

Five pillars. They are five different *kinds of thing a couple needs*, not
five ways of saying the same thing. Each pillar has a different job in the
funnel, a different format, and a different success measure.

The pillar definitions live in `marketing/lib/config.mjs` (`PILLARS`) and the
per-pillar generation rules in `marketing/lib/prompts.mjs` (`PILLAR_RULES`).
This document is the reasoning behind them.

## The funnel the pillars map onto

```
reach  ->  engagement  ->  profile visits  ->  website clicks  ->  registrations  ->  enquiries
```

Nobody is measured on followers. A pillar is judged by the stage it is
responsible for moving.

---

## 1. Wedding inspiration

- **Objective**: awareness (top of funnel, reach).
- **Format**: carousel, 4:5.
- **Audience**: both, with different subjects - Greek couples get Greek
  weddings and Greek settings; destination couples get the islands and the
  mainland.
- **Landing page**: a location or category page with real inventory.
- **Measured by**: reach, impressions, profile visits, saves.
- **Why it exists**: this is the pillar that brings strangers in. It is
  allowed to convert poorly. A post that only performs on reach is doing its
  job.

Content: settings, decoration, the shape of a day, season. Never a claim
about a vendor's work, because that means using their photography.

## 2. Practical wedding guides

- **Objective**: consideration.
- **Format**: carousel, 4:5.
- **Audience**: both.
- **Landing page**: a guide-relevant category page, or `/signup` for a
  planning checklist.
- **Measured by**: saves, shares, clicks to the directory.
- **Why it exists**: the pillar that gets saved and sent to a partner. Guides
  are the cheapest thing to make correct and the easiest thing to be
  genuinely useful at.

Content: how to choose a photographer, when to book, what to ask, what
happens in the paperwork, what a day actually costs. This is where local
specificity pays most.

## 3. Vendor discovery

- **Objective**: consideration, and the primary driver of website clicks.
- **Format**: reel, 9:16.
- **Audience**: both.
- **Landing page**: a category page, location page, or a location +
  category combination - the most specific page that has inventory.
- **Measured by**: clicks into the directory, and registrations by category.
- **Why it exists**: this is the pillar with the money. A couple who lands on
  "photographers in Santorini" with 40 listings is one click from a
  registration.

Content: "5 photographers to discover in Athens" - never "the top 5". The
selection is *discovery*, and the copy says so. A reel that introduces five
real listings from the directory, with the count of how many exist, is
honest and useful. A reel that ranks them is not.

Rule: every vendor named in a discovery post must have a snapshot in
`vendor_snapshots`, and the validator re-fetches the listing to confirm the
name, rating and claim status have not changed. If a listing disappears
between generation and approval, the post fails validation.

## 4. Couple engagement

- **Objective**: awareness, plus community.
- **Format**: reel (poll / this-or-that) or story sequence.
- **Audience**: both.
- **Landing page**: usually none - this is the one pillar that does not need
  a link. The validator exempts it.
- **Measured by**: comments, shares, profile visits.
- **Why it exists**: comments and shares are what buy reach on both
  platforms, and a poll costs almost nothing to produce.

Content: "this or that" between two real categories, "what is your
non-negotiable", a question about the day itself. No link, no CTA, no
falsified urgency.

## 5. Product demonstration

- **Objective**: registration. This is the conversion pillar.
- **Format**: reel, 9:16, with our own product screenshots.
- **Audience**: both.
- **Landing page**: `/signup`, or a directory page for the demo being shown.
- **Measured by**: registrations, and clicks that turn into registrations.
- **Why it exists**: this is the only pillar whose job is the business
  outcome. It shows the actual interface - search by location, filter by
  category, compare, save, send a request.

Content: a screen recording or a sequence of real screenshots of the real
product. The product pillar is the one place where using the app's own
screenshots is both permitted and correct.

---

## The weekly shape

| Day | Pillar | Format | Local time |
| --- | --- | --- | --- |
| Monday | Practical guides | carousel | 10:30 |
| Tuesday | Vendor discovery | reel | 18:30 |
| Wednesday | Wedding inspiration | carousel | 12:00 |
| Thursday | Product demonstration | reel | 11:00 |
| Friday | Couple engagement | reel | 20:00 |

Five posts a week, each republished to Instagram and Facebook with a
platform-appropriate caption. Weekend stories are supported by the config
(`weekendStories`) but are off by default.

Times are Europe/Athens and are converted to UTC per post, DST-safe.

## Why each post has its own landing page

A post that always links to the homepage wastes the click. The pillar
decides the target, and `lib/seo-pages.mjs` picks the most specific page that
actually has inventory - a location + category combination if one exists, a
location page if it passes the index floor, a category page otherwise, and
the directory only as a last resort.

A landing page that is below the index floor is deliberately not linked: it
is not indexable, so sending traffic to it wastes the visit and creates a
landing-page mismatch for the search engines.
