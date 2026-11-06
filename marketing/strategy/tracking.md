# Where the tracking lives

There are **two acquisition engines** — the email engine (Mailrelay letters to
vendors) and this one (social posts to couples) — and they are measured in
**three places**. This is the map: which surface holds what, and where you look
when someone asks "where do our acquisitions come from?".

```
Postiz                      WeddingWise app                mediaFlow (this engine)
─────────────────────       ──────────────────────         ──────────────────────
publishes the posts         every conversion               joins the two
holds post metrics          is the source of truth          answers the weekly question
        │                            │                              │
   npm run collect          Admin → Analytics → Acquisition   npm run collect-conversions
        │                            │                              │
        └──── metrics ──────────────┴──── conversions ────────────┘
                                 (utm_campaign is the join key)
```

## The three surfaces

| Surface | Holds | How you read it |
| --- | --- | --- |
| **Postiz** (`postiz.weddingwise.gr`, self-hosted) | the published posts and their **per-post metrics** — reach, likes, comments | `npm run collect` pulls them into the `metrics` table; `npm run status` shows whether the plumbing works |
| **WeddingWise** (`marketing_attributions`) | **every conversion** — the source of truth for what actually happened on the site | the admin UI: **Admin → Analytics → Acquisition** (`/admin/analytics/acquisition`) |
| **mediaFlow** (this engine, `marketing/db.mjs`) | the **join** — campaigns, posts, metrics and the conversions attributed to each | `npm run collect-conversions`, then `npm run report` |

**Postiz holds no conversions.** A post's follower is not a lead: Postiz knows
that a post was published and how it performed, and nothing about who visited
the site afterwards. Conversions live only in WeddingWise.

**WeddingWise holds no post metrics.** The app does not know which post a
couple came from; it knows the campaign string the link carried. The join
between the two is made here, in this engine.

## The conversions, and who owns them

| Type | Meaning | Engine |
| --- | --- | --- |
| `registration` | a couple (or anybody) signed up | social |
| `enquiry` | a couple contacted a vendor | social |
| `claim_invitation` | a vendor was sent a claim letter | email |
| `claim_visit` | a vendor opened their claim link | email |
| `vendor_claim` | a vendor claimed their listing | email |
| `planner_claim` | a planner claimed their listing | email |
| `profile_completed` | a vendor filled the profile in | email |
| `vendor_activated` | a vendor received their first enquiry | email |

The four social types are what this engine consumes. The rest belong to the
email engine and are read in the admin UI.

## The endpoint

```
GET {WW_API_BASE_URL}/api/v1/internal/marketing/conversions
    ?since=YYYY-MM-DD[&type=…][&types=a,b]
Authorization: Bearer {WW_INTERNAL_TOKEN}
```

- **`since`** — required, `YYYY-MM-DD`.
- **`type`** — one type.
- **`types`** — a comma-separated list. Every value is validated; an unknown
  value is a **400**.
- **No filter at all** — the response carries **only `registration` and
  `enquiry`**.

### The default-type contract (do not break it)

`automation/collect-conversions.mjs` asks for **no filter**, and it coerces
every row that is not an `enquiry` into a `registration`. So the answer to an
unfiltered request must stay exactly what it was before the lifecycle types
existed.

This is why the app has **two** sets of types: `ALL_TYPES` (what a caller may
ask for — validation) and `DEFAULT_TYPES` (what a caller gets when it asks for
nothing — `registration`, `enquiry`). The filter that protects this engine
lives in the app's **repository**, not only in its controller, so a caller that
skips the validation is still protected.

**The consequence here:** if you ever pass `?types=` with a lifecycle type in
it, this engine's consumer will file that row as a `registration` and corrupt
the weekly report. Do not do that. The email engine's numbers are read in the
admin UI, not here.

## The two UTM shapes

The engines do not use the same parameter shapes, so the join key is
**`utm_source` + `utm_campaign`**, never `utm_content` alone.

| Parameter | Social (this engine) | Email (the claim letters) |
| --- | --- | --- |
| `utm_source` | `weddingwise` | `mailrelay` |
| `utm_medium` | `social` | `email` |
| `utm_campaign` | `ww_{audience}_{pillar}_{target}_{yyyymmdd}` | `claim_vendor_2026_10` — a **stable machine key**, not a name with a date in it |
| `utm_content` | `{platform}_{fingerprint8}` | `category:{vendor_type slug}` |
| `utm_term` | optional | — |

The social `utm_campaign` is written into the `campaigns` table once and never
rewritten, so it is a stable join key between a post and the registration that
came back from it.

The email `utm_campaign` is the same idea: the campaign's human name lives in
`email_campaigns.name` and the **machine key** is what travels in the link, so
the dimension does not fragment per day.

## The admin page

`/admin/analytics/acquisition` (Admin → Analytics → Acquisition) reads the
app database only, and answers the six questions the two engines raise:

| Panel | What it shows |
| --- | --- |
| Vendor campaign performance | one row per email campaign: invitations, claims, activations |
| Mailrelay delivery statistics | `email_campaign_sends.status` — queued, sent, delivered, failed, bounced, suppressed, unsubscribed |
| Claim conversion rates | claims ÷ invitations, visits ÷ invitations |
| Vendor activation rates | activations ÷ claims, activations ÷ invitations |
| Couple acquisition from social campaigns | `registration` rows joined to couples, grouped by `utm_campaign` — **this engine's numbers** |
| Combined acquisition performance | both engines in one table, keyed on `utm_source` / `utm_medium` / `utm_campaign` |

The last panel is the one that answers "where do our acquisitions come from,
whichever engine produced them".

## The rules

1. **One source of truth.** WeddingWise holds the conversions. Postiz holds the
   post metrics. This engine holds neither — it joins them.
2. **Nothing reaches a social channel without a human approving it.** The same
   applies to the other engine: a letter goes out only when a human runs the
   campaign.
3. **The unfiltered endpoint answer does not change.** It is the contract with
   this engine's consumer and with the weekly report.
