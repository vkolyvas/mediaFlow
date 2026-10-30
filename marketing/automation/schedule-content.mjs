#!/usr/bin/env node
/**
 * Schedules approved posts through Postiz.
 *
 * The rules this enforces:
 *  - only an APPROVED post is scheduled;
 *  - a reel, carousel or story needs its media on disk before it is sent;
 *  - the media is uploaded to Postiz first, because Instagram and Facebook
 *    only accept URLs that Postiz has verified;
 *  - the post is scheduled, never published immediately - an immediate post
 *    would slip past the approval workflow;
 *  - the Postiz post id is written back so the analytics collector can find
 *    it later.
 *
 *   node automation/schedule-content.mjs [--limit 5] [--date 2026-11-03]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, env } from '../lib/config.mjs';
import { listPosts, getCampaign, updatePost, recordEvent, closeDb } from '../lib/db.mjs';
import { assertTransition, STATES } from '../lib/state.mjs';
import * as postiz from '../lib/postiz.mjs';
import { zonedToUtc, formatInZone } from '../lib/time.mjs';

const FORMATS_NEEDING_MEDIA = new Set(['reel', 'carousel', 'story']);

function parseArgs(argv) {
  const args = { limit: 10, date: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--limit') args.limit = Number(argv[++i]);
    else if (key === '--date') args.date = argv[++i];
    else if (key === '--dry-run') args.dryRun = true;
  }
  return args;
}

function loadScheduleConfig() {
  const file = path.join(PATHS.strategy, 'schedule-config.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** When this post goes out, in the audience's timezone. */
function scheduledInstant(campaign, post, config) {
  const slot = config.byPillar?.[post.pillar] || config.default || { hour: 11, minute: 0 };
  const dateStr = campaign?.planned_date || new Date().toISOString().slice(0, 10);
  return zonedToUtc(dateStr, slot.hour ?? 11, slot.minute ?? 0, config.timezone || 'Europe/Athens');
}

/** Resolves the media files for a post, relative to the assets directory. */
function resolveMedia(post) {
  const media = post.media || [];
  const resolved = [];
  for (const item of media) {
    if (!item || !item.path) continue;
    const absolute = item.path.startsWith('/')
      ? path.join(env.assetsDir, item.path)
      : path.resolve(env.assetsDir, item.path);
    if (!fs.existsSync(absolute)) {
      throw new Error(`media file is missing: ${absolute}`);
    }
    resolved.push({ absolute, alt: item.alt || post.script?.altText || '' });
  }
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv);
  const config = loadScheduleConfig();

  let posts = listPosts({ state: STATES.APPROVED });
  if (args.date) {
    posts = posts.filter((p) => getCampaign(p.campaignId)?.planned_date === args.date);
  }
  posts = posts.slice(0, args.limit);

  if (!posts.length) {
    console.log('No approved posts to schedule.');
    closeDb();
    return;
  }

  const connection = await postiz.checkConnection();
  if (!connection.ok) {
    console.error(`Cannot reach Postiz: ${connection.error}`);
    console.error('Check POSTIZ_API_URL and POSTIZ_API_KEY in marketing/.env');
    closeDb();
    process.exit(1);
  }

  const integrations = new Map();
  let scheduled = 0;
  let failed = 0;

  for (const post of posts) {
    const campaign = getCampaign(post.campaignId);
    const instant = scheduledInstant(campaign, post, config);
    const when = formatInZone(instant, config.timezone || 'Europe/Athens');

    if (instant.getTime() < Date.now()) {
      console.error(`  ${post.id}: the planned slot (${when}) is in the past - skipped`);
      failed += 1;
      continue;
    }

    try {
      let media = [];
      if (FORMATS_NEEDING_MEDIA.has(post.format)) {
        media = resolveMedia(post);
        if (!media.length) {
          throw new Error(`a ${post.format} needs media before it can be scheduled`);
        }
      }

      if (!integrations.has(post.platform)) {
        const id = await postiz.findIntegration(post.platform);
        if (!id) {
          throw new Error(`no Postiz integration is connected for ${post.platform}`);
        }
        integrations.set(post.platform, id);
      }
      const integrationId = integrations.get(post.platform);

      if (args.dryRun) {
        console.log(`  ${post.id} -> ${post.platform} at ${when} (dry run, ${media.length} media)`);
        scheduled += 1;
        continue;
      }

      const uploaded = [];
      for (const item of media) {
        uploaded.push(await postiz.upload(item.absolute));
      }

      const caption = post.utm_url ? `${post.caption}\n\n${post.utm_url}` : post.caption;
      const result = await postiz.createPost({
        content: caption,
        media: uploaded,
        alt: media.map((m) => m.alt).filter(Boolean),
        integrationId,
        date: instant,
        type: 'schedule',
      });

      assertTransition(post.state, STATES.SCHEDULED);
      updatePost(post.id, {
        state: STATES.SCHEDULED,
        postizPostId: result.id,
        scheduledAt: instant.toISOString(),
        error: null,
      });
      recordEvent(post.id, post.state, STATES.SCHEDULED, 'scheduler', `postiz post ${result.id}`);

      console.log(`  ${post.id} -> ${post.platform} at ${when} (postiz ${result.id})`);
      scheduled += 1;
    } catch (err) {
      updatePost(post.id, { state: STATES.FAILED, error: err.message });
      recordEvent(post.id, post.state, STATES.FAILED, 'scheduler', err.message);
      console.error(`  ${post.id}: FAILED - ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\n${scheduled} scheduled, ${failed} failed.`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
