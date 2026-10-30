# Environment

Every variable the engine reads, where it comes from, and what breaks without
it. Copy `marketing/.env.example` to `marketing/.env` and fill it in.
`marketing/.env` is gitignored; never commit it.

## WeddingWise application

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `WW_API_BASE_URL` | no | `https://api.weddingwise.gr` | The backend API base, **without** the `/api/v1` suffix - the client appends it. |
| `WW_API_TOKEN` | no | - | Bearer token for endpoints that are not public. The vendor listing endpoints used by the engine are public, so this is normally empty. |
| `WW_INTERNAL_TOKEN` | for `collect-conversions` | - | Bearer token for `GET /api/v1/internal/marketing/conversions`. Must match `MARKETING_INTERNAL_TOKEN` in the app repo. Without it, registrations cannot be attributed. |
| `WW_SITE_URL` | no | `https://weddingwise.gr` | The public origin used to build landing-page URLs. |
| `WW_DEMO_STRICT` | no | - | `1` turns a demo record that reached the engine into a hard error instead of a silent skip. |
| `WW_DEMO_SLUG_BLOCKLIST` | no | - | Comma-separated extra slugs to exclude, for when the seed set changes. |

## Anthropic

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | for `generate` | - | Without it, generation fails loudly and posts stay in `IDEA`. |
| `DEFAULT_MODEL` | no | `claude-sonnet-4-20250514` | |
| `MAX_TOKENS_PER_CALL` | no | `4000` | Raise it if a reel script is being cut short. |

## Postiz

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `POSTIZ_API_URL` | for `schedule` / `collect` | `http://localhost:4007/api` | Must include the `/api` suffix. The CLI appends `/public/v1/<endpoint>`. |
| `POSTIZ_API_KEY` | for `schedule` / `collect` | - | Created in Postiz under Settings -> API Keys. |
| `POSTIZ_INSTAGRAM_ID` | no | auto | The integration id. Left empty, the engine resolves it by platform at schedule time. |
| `POSTIZ_FACEBOOK_ID` | no | auto | As above. |

## Storage and reporting

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `MARKETING_ASSETS_DIR` | no | `./assets/generated` | Where rendered media is written before it is uploaded. |
| `MARKETING_DB_PATH` | no | `.data/marketing.db` | The SQLite file. The tests point this at a temp directory. |
| `UTM_MEDIUM` | no | `social` | The `utm_medium` on every published link. |
| `MARKETING_PUBLIC_URL` | no | `WW_SITE_URL` | The public base used in reports. |

## How the tokens get created

| Secret | Where |
| --- | --- |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `POSTIZ_API_KEY` | the Postiz instance, Settings -> API Keys |
| `WW_INTERNAL_TOKEN` / `MARKETING_INTERNAL_TOKEN` | generated once (`openssl rand -base64 48`), set in both repos, never the same value as `INTERNAL_HEALTH_TOKEN` |

## The campaign naming scheme

`utm_campaign` is the join key between a post and the registration it
produced, so it must stay stable for the life of a campaign.

```
utm_source   = weddingwise
utm_medium   = social              (UTM_MEDIUM)
utm_campaign = ww_{audience}_{pillar}_{target}_{yyyymmdd}
utm_content  = {platform}_{fingerprint8}
utm_term     = optional
```

The audience is `greek` or `destination`, the pillar is one of the five
pillar ids, and the target is the ASCII slug of the place and category. The
date is the planned publication date.

Example: `ww_greek_discovery_athina-wedding-equipment_20261103`.

The string is written into the `campaigns` table once and never rewritten -
that is what makes it safe to join on.
