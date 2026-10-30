# Self-hosted Postiz

Postiz is the publishing layer of the acquisition engine: it holds the
connected Instagram and Facebook accounts, uploads the media, and runs the
scheduled queue. We host it ourselves so that the social accounts, the
content and the analytics stay under our control.

Upstream: `gitroomhq/postiz-app`. Licence: **AGPL-3.0**.

## What is here

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | The stack, trimmed from upstream |
| `.env.example` | Every setting, with the ones we need marked |
| `setup.sh` | Checks Docker, writes `.env` with real secrets, starts the stack |

## What was trimmed, and why

Upstream ships eight services. We run four:

- **Elasticsearch** - removed. Temporal runs with `ENABLE_ES=false`, which
  Temporal supports for single-node deployments. It was the single largest
  memory consumer in the upstream compose (a full Elasticsearch JVM).
- **Temporal UI and admin-tools** - removed. They are debugging tools; the
  Postiz UI and the marketing engine cover what we need.
- **Spotlight** - removed. Error monitoring only.
- **The second Postgres** - removed. Temporal now uses the `temporal`
  database on the same Postgres server as Postiz, which is what the
  upstream `POSTGRES_SEEDS` mechanism is for.

The result is four containers: `postiz`, `postiz-postgres`, `postiz-redis`,
`temporal`.

If the host is tight on memory, `temporal` is the one to think about - Postiz
will refuse to schedule without it, but you can run it on another host and
point `TEMPORAL_ADDRESS` at it.

## Requirements

- Docker Engine with the compose v2 plugin
- ~2GB RAM free, ~5GB disk for the images and the Postgres volume
- A public hostname with TLS in front of the container (Instagram's OAuth
  redirect will not accept `http://localhost`)

The host this repo is developed on does not have Docker installed yet -
`setup.sh` says so and prints the install command rather than failing
obscurely.

## Bringing it up

```bash
cd marketing/infra/postiz
./setup.sh
```

That writes `.env` with a generated `JWT_SECRET` and `POSTGRES_PASSWORD`,
starts the stack, and waits for the app to answer. Then:

1. Open the instance and create the first admin account.
   `DISABLE_REGISTRATION` is set to `true` in the compose, so registration is
   closed once the account exists.
2. **Settings -> Public API** -> create a key. This is `POSTIZ_API_KEY`.
3. **Integrations** -> connect Instagram and Facebook.

## Wiring it to the marketing engine

In `marketing/.env`:

```
POSTIZ_API_URL=https://postiz.your-domain.gr/api
POSTIZ_API_KEY=<the key from step 2>
```

The URL must include the `/api` suffix - the Postiz public API lives under
`{base}/public/v1`, and `lib/postiz.mjs` appends that path.

Check it end to end without publishing anything:

```bash
cd marketing
npm run schedule -- --dry-run
```

That lists what would be scheduled, with the computed local time per post and
the number of media files, without uploading or creating anything.

## Connecting Instagram and Facebook

Postiz talks to the Meta Graph API. The credentials it needs are a Facebook
App with an Instagram Business account attached.

**One-time setup.**

1. Create a Business portfolio at business.facebook.com, then a Facebook App
   of type *Business* (Web). Meta requires the app to be in *Live* mode to
   publish; Development-mode apps can only publish to app-role accounts.
2. Add the *Instagram* product to the app, and attach an Instagram
   professional (Business or Creator) account to the Facebook page.
3. App settings -> Basic: set the app domain and the privacy policy URL
   (both must be publicly reachable over HTTPS - Postiz itself can serve as
   the privacy URL host).
4. Facebook Login -> Settings: add the OAuth redirect URI
   `https://postiz.your-domain.gr/api/public/v1/integrations/facebook/callback`.
5. App review: request the permissions that publishing needs -
   `instagram_basic`, `instagram_content_publish`,
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `business_management`. For a Business app using the System User, the
   review is much faster than the Graph API Explorer path.
6. Put `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in `.env` and restart the
   Postiz container.

**In Postiz.**

Add the integration with *Facebook* as the provider and select the page; the
Instagram account that is attached to that page appears as a separate
integration. The marketing engine finds the right integration by platform
(`lib/postiz.mjs` -> `findIntegration`), so the account it picks is whatever
Postiz has connected for `instagram` / `facebook`.

The credentials in `.env` are what Postiz needs to refresh tokens. The
per-account tokens Postiz stores are managed in its own UI.

## Media URLs

Instagram and Facebook only accept media URLs that Postiz has verified, so
every file is uploaded through Postiz before the post is created. The
marketing engine always goes through `postiz.upload()` first - see
`lib/postiz.mjs`.

This is also why `STORAGE_PROVIDER=cloudflare` (R2) is the right production
setting: with `local` storage the uploads live inside the container volume
and are served by Postiz itself, which works but ties every asset's lifetime
to that volume. R2 gives public, durable URLs.

## Backup

Two things matter and neither is in the repo:

- **The Postgres volume** - holds the integrations, the credentials, the
  scheduled posts and their history.
- **The uploads volume** - only when `STORAGE_PROVIDER=local`.

```bash
docker exec postiz-postgres pg_dump -U postiz-user postiz-db-local > postiz-$(date +%F).sql
```

## AGPL-3.0 obligations

Postiz is licensed under the GNU Affero General Public License v3.0. We run it
unmodified, as a separate service, and we do not distribute it. That keeps us
in the ordinary AGPL position:

- **Network use is distribution.** Section 13 requires that users interacting
  with the software over a network are offered the corresponding source of
  *our modified version*. We make no modifications, so the obligation is
  satisfied by offering Postiz's own source, which its UI already links to.
- **If we modify Postiz** - and we may need to, to change the UI language to
  Greek, or to change how the queue is rendered - the modified version must be
  offered to those users. Keep the modifications in a public repository or be
  ready to publish them.
- **The source link must stay reachable.** If we ever remove Postiz's link to
  its source from the UI, that is a violation on its own. Do not hide it.
- **Do not copy Postiz code into `marketing/`.** The marketing engine talks to
  Postiz over the public HTTP API and vendors the `postiz` CLI as a binary
  dependency, not as source. That keeps the AGPL copyleft from reaching this
  repository, which is not AGPL.

This is a summary, not legal advice. If Postiz is ever embedded in the
WeddingWise product rather than run as a separate service, or if we modify
it, re-read the licence and take advice.
