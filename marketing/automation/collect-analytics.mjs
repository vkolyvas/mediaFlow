#!/usr/bin/env node
/**
 * Collects performance for every post that has a Postiz id.
 *
 *   node automation/collect-analytics.mjs [--days 7]
 */
import { listPosts, insertMetrics, closeDb } from '../lib/db.mjs';
import * as postiz from '../lib/postiz.mjs';
import { normaliseMetrics, metricDate } from '../lib/metrics.mjs';

function parseArgs(argv) {
  const args = { days: 7 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--days') args.days = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const posts = listPosts({}).filter((p) => p.postizPostId);

  if (!posts.length) {
    console.log('No posts have a Postiz id yet. Run `npm run schedule` first.');
    closeDb();
    return;
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
