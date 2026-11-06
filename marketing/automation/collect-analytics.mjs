#!/usr/bin/env node
/**
 * Collects performance for every post that has a Postiz id.
 *
 *   node automation/collect-analytics.mjs [--days 7]
 */
import { listPosts, insertMetrics, closeDb } from '../lib/db.mjs';
import { STATES } from '../lib/state.mjs';
import { outcomeFromPostiz, applyPostizState } from '../lib/publish-state.mjs';
import * as postiz from '../lib/postiz.mjs';
import { normaliseMetrics, metricDate } from '../lib/metrics.mjs';

function parseArgs(argv) {
  const args = { days: 7 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--days') args.days = Number(argv[++i]);
  }
  return args;
}

/**
 * Brings the local state back in line with Postiz.
 *
 * Postiz publishes on its own schedule and nobody tells us that it did, so
 * without this the pipeline stops at SCHEDULED for ever and the post never
 * reaches the report. Postiz holds the truth for every post it has: the post
 * is PUBLISHED once it has gone out, and ERROR when the platform refused it.
 */
async function reconcileWithPostiz(posts) {
  const scheduled = posts.filter((p) => p.state === STATES.SCHEDULED && p.postizPostId);
  if (!scheduled.length) return { published: 0, failed: 0 };

  const dates = scheduled
    .map((p) => p.scheduled_at)
    .filter(Boolean)
    .sort();
  const start = dates[0] || new Date(Date.now() - 30 * 86400000).toISOString();
  const end = new Date(Date.now() + 30 * 86400000).toISOString();

  const remote = await postiz.listPosts({ startDate: start, endDate: end });
  const byId = new Map(remote.map((p) => [String(p.id), p]));

  let published = 0;
  let failed = 0;
  for (const post of scheduled) {
    const live = byId.get(String(post.postizPostId));
    if (!live) continue;
    const outcome = outcomeFromPostiz(live);
    if (!outcome) continue;
    applyPostizState(post, live);
    if (outcome.state === STATES.PUBLISHED) published += 1;
    if (outcome.state === STATES.FAILED) failed += 1;
  }
  return { published, failed };
}

async function main() {
  const args = parseArgs(process.argv);
  const posts = listPosts({}).filter((p) => p.postizPostId);

  if (!posts.length) {
    console.log('No posts have a Postiz id yet. Run `npm run schedule` first.');
    closeDb();
    return;
  }

  try {
    const { published, failed } = await reconcileWithPostiz(posts);
    if (published || failed) {
      console.log(`${published} post(s) published, ${failed} failed, per Postiz.`);
    }
  } catch (err) {
    // Postiz being unreachable must not cost us the analytics we can get.
    console.error(`Could not reconcile the published state: ${err.message}`);
  }

  let collected = 0;
  let missing = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      const payload = await postiz.postAnalytics(post.postizPostId, args.days);
      if (!payload || payload.missing) {
        missing += 1;
        continue;
      }
      const totals = normaliseMetrics(payload);
      const date = metricDate(payload);
      insertMetrics({
        postId: post.id,
        platform: post.platform,
        date,
        ...totals,
        raw: payload,
      });
      collected += 1;
      console.log(
        `  ${post.id}  reach ${totals.reach}  impressions ${totals.impressions}  likes ${totals.likes}  shares ${totals.shares}  saves ${totals.saves}  clicks ${totals.clicks}`,
      );
    } catch (err) {
      failed += 1;
      console.error(`  ${post.id}: ${err.message}`);
    }
  }

  console.log(`\n${collected} snapshots collected, ${missing} without data, ${failed} failed.`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
