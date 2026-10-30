# Deployment

The engine is a directory of scripts and one SQLite file. There is nothing to
build and nothing to run as a service. What needs deploying is Postiz, and
what needs deploying in the app repo is the UTM capture branch.

## What has to exist before anything is published

| Piece | Where | Status |
| --- | --- | --- |
| Postiz instance | `infra/postiz/` | compose written, not yet deployed - the host has no Docker yet |
| Instagram + Facebook accounts connected | in Postiz | needs Meta app credentials |
| `ANTHROPIC_API_KEY` | the engine's environment | not present on this host |
| UTM capture branch | `auth-weddingwise`, branch `feature/weddingwise-utm-capture` | committed, not merged, not deployed |
| `MARKETING_INTERNAL_TOKEN` | both repos | to be generated |

## 1. Postiz

```bash
cd marketing/infra/postiz
./setup.sh
```

See `infra/postiz/README.md` for the Meta app setup, the R2 storage, the
backup and the AGPL-3.0 obligations.

## 2. The UTM capture branch

In `auth-weddingwise`:

```bash
npm run migrate                       # applies 0342_marketing_attribution
MARKETING_INTERNAL_TOKEN=<token>      # in the environment
```

The frontend change (the two cookies) ships with the same deployment as the
backend change - the backend does nothing without the cookie, and the cookie
does nothing without the backend.

Full explanation: `auth-weddingwise/docs/MARKETING_ATTRIBUTION.md`.

## 3. The engine

```bash
cd marketing
npm install
cp .env.example .env
```

Fill in:

```
ANTHROPIC_API_KEY=...
POSTIZ_API_URL=https://postiz.example.gr/api
POSTIZ_API_KEY=...
WW_INTERNAL_TOKEN=<the same token as MARKETING_INTERNAL_TOKEN>
```

Then check the two directions work before publishing anything:

```bash
npm run status                                  # the queue
npm run schedule -- --dry-run                   # Postiz is reachable and the slots are right
npm run collect-conversions                      # the app endpoint is reachable
```

`collect-conversions` should print "Fetched N conversion(s)". If it prints a
404, the app branch is not deployed.

## 4. The weekly rhythm

The engine is driven by a human, not by a timer. The only thing worth putting
on a schedule is the collection and the report.

```
Monday    npm run collect
          npm run collect-conversions
          npm run report
```

A cron entry on the marketing host:

```cron
17 8 * * 1  cd /srv/mediaFlow/marketing && /usr/bin/npm run collect >> /var/log/ww-collect.log 2>&1
17 9 * * 1  cd /srv/mediaFlow/marketing && /usr/bin/npm run collect-conversions >> /var/log/ww-collect.log 2>&1
22 9 * * 1  cd /srv/mediaFlow/marketing && /usr/bin/npm run report >> /var/log/ww-report.log 2>&1
```

The calendar, the generation and the approval stay manual on purpose:
generating and approving content is a person deciding what the brand says.
Automating the approval would remove the only thing that makes this safe.

## 5. Storage and state

| What | Where | Backed up |
| --- | --- | --- |
| The pipeline state | `marketing/.data/marketing.db` | yes - it is the record of every post, campaign and result |
| Rendered media | `marketing/assets/rendered/` | regenerable |
| The Postiz database | the `postgres-volume` in the Postiz compose | yes - see `infra/postiz/README.md` |
| The attribution rows | the app database | with the app |

```bash
sqlite3 marketing/.data/marketing.db ".backup /var/backups/marketing-$(date +%F).db"
```

The `.data` directory is gitignored, so the database is not in the
repository. Copy it off the host.

## 6. Failure modes

| What breaks | What happens | What to do |
| --- | --- | --- |
| The Anthropic key is missing or wrong | `npm run generate` fails, the posts stay in `IDEA` | fix the key, re-run |
| Postiz is unreachable | `npm run schedule` exits with a clear message | check the instance, re-run; nothing was half-published |
| The app branch is not deployed | `collect-conversions` reports a 404 | deploy the branch; the report says conversions are zero rather than pretending |
| The landing page was renamed | validation fails on `unknown_landing_page` | update `lib/seo-pages.mjs`, re-validate |
| A vendor was renamed or removed | validation fails on `vendor_drift` | regenerate the post |
| The demo seed rows change | `demo-filter` drops them; with `WW_DEMO_STRICT=1` it errors | update `DEMO_SLUGS` in `lib/demo-filter.mjs` |

## 7. What must not be deployed

- The `.env` file. It is gitignored, and the tokens in it are the only
  secrets the engine has.
- A modified Postiz image without reading the AGPL obligations. We run
  Postiz unmodified today. If we change it, the modified source has to be
  offered to the users of the service - see `infra/postiz/README.md`.
