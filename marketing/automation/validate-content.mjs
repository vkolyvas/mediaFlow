#!/usr/bin/env node
/**
 * Validates generated content against live data.
 *
 * Every generated post is re-checked before a human is asked to approve it.
 * A post that passes moves to VALIDATED; a post that fails moves to FAILED
 * with the reason recorded, and it can never be scheduled.
 *
 *   node automation/validate-content.mjs [--limit 20] [--state GENERATED]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../lib/config.mjs';
import { listPosts, getCampaign, updatePost, recordEvent, closeDb } from '../lib/db.mjs';
import { assertTransition, STATES } from '../lib/state.mjs';
import { validatePost } from '../lib/validate.mjs';

function parseArgs(argv) {
  const args = { limit: 100, state: STATES.GENERATED, offline: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--limit') args.limit = Number(argv[++i]);
    else if (key === '--state') args.state = argv[++i];
    else if (key === '--offline') args.offline = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const posts = listPosts({ state: args.state }).slice(0, args.limit);
  const allPosts = listPosts({});

  if (!posts.length) {
    console.log(`No posts in state ${args.state}.`);
    closeDb();
    return;
  }

  const report = [];
  let passed = 0;
  let failed = 0;

  for (const post of posts) {
    const campaign = getCampaign(post.campaignId);
    const { ok, findings } = await validatePost(post, {
      campaign,
      allPosts,
      checkNetwork: !args.offline,
    });

    const from = post.state;
    const to = ok ? STATES.VALIDATED : STATES.FAILED;
    assertTransition(from, to);
    updatePost(post.id, {
      state: to,
      error: ok ? null : findings.filter((f) => f.level === 'error').map((f) => f.message).join('; '),
    });
    recordEvent(post.id, from, to, 'validator', ok ? 'validated' : 'validation failed');

    if (ok) passed += 1;
    else failed += 1;

    report.push({ id: post.id, pillar: post.pillar, audience: post.audience, platform: post.platform, ok, findings });

    const mark = ok ? 'PASS' : 'FAIL';
    console.log(`${mark}  ${post.id}`);
    for (const f of findings) {
      console.log(`      [${f.level}] ${f.code}: ${f.message}`);
    }
  }

  const dir = path.join(PATHS.analytics, 'validation');
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n${passed} passed, ${failed} failed. Report: ${outFile}`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
