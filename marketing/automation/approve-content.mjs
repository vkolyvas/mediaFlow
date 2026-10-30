#!/usr/bin/env node
/**
 * The human approval gate.
 *
 * Nothing reaches a social channel without passing through here. A post is
 * printed in full - caption, hashtags, link, visual brief - and a human
 * decides.
 *
 *   node automation/approve-content.mjs                     list what is waiting
 *   node automation/approve-content.mjs --id p_...          approve one post
 *   node automation/approve-content.mjs --id p_... --reject decline it
 *   node automation/approve-content.mjs --all               approve everything waiting
 *
 * The state machine enforces the order: only a VALIDATED post can be
 * approved, and only an APPROVED post can be scheduled.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../lib/config.mjs';
import { listPosts, getCampaign, updatePost, recordEvent, closeDb } from '../lib/db.mjs';
import { assertTransition, STATES } from '../lib/state.mjs';

function parseArgs(argv) {
  const args = { id: null, reject: false, all: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--id') args.id = argv[++i];
    else if (key === '--reject') args.reject = true;
    else if (key === '--all') args.all = true;
  }
  return args;
}

function printPost(post) {
  const campaign = getCampaign(post.campaignId);
  const script = post.script || {};
  const lines = [
    '',
    `  ${post.id}`,
    `  pillar      : ${post.pillar} (${campaign?.objective || '?'})`,
    `  audience    : ${post.audience}`,
    `  platform    : ${post.platform}`,
    `  format      : ${post.format}`,
    `  link        : ${post.utm_url || '(none)'}`,
    `  published   : ${campaign?.planned_date || '?'}`,
    '',
    `  caption:`,
    ...String(post.caption || '')
      .split('\n')
      .map((line) => `    ${line}`),
    '',
    `  hashtags    : ${(post.hashtags || []).join(' ')}`,
    `  cta         : ${post.cta || '(none)'}`,
  ];

  if ((script.slides || []).length) {
    lines.push('', '  slides:');
    script.slides.forEach((slide, i) => {
      lines.push(`    ${i + 1}. ${slide.headline}`);
      if (slide.body) lines.push(`       ${slide.body}`);
    });
  }
  if ((script.shotList || []).length) {
    lines.push('', '  shot list:');
    script.shotList.forEach((shot, i) => {
      lines.push(`    ${i + 1}. ${shot.visual}`);
      if (shot.onScreenText) lines.push(`       on screen: ${shot.onScreenText}`);
      if (shot.voiceover) lines.push(`       voiceover: ${shot.voiceover}`);
    });
  }
  if (post.visual_brief) {
    lines.push('', '  visual brief:', `    ${post.visual_brief}`);
  }
  if ((post.vendor_refs || []).length) {
    lines.push('', '  vendors used:');
    for (const ref of post.vendor_refs) {
      lines.push(
        `    - ${ref.businessName} | rating ${ref.ratingAverage ?? 'n/a'} (${ref.ratingCount ?? 0}) | ${ref.claimed ? 'claimed' : 'unclaimed'}`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

function moveDraftFile(post, target) {
  const dir = path.join(PATHS.content, target);
  fs.mkdirSync(dir, { recursive: true });
  const from = path.join(PATHS.content, 'drafts', `${post.id}.json`);
  if (!fs.existsSync(from)) return null;
  const to = path.join(dir, `${post.id}.json`);
  fs.copyFileSync(from, to);
  return to;
}

function main() {
  const args = parseArgs(process.argv);

  if (!args.id && !args.all) {
    const waiting = listPosts({ state: STATES.VALIDATED });
    if (!waiting.length) {
      console.log('Nothing is waiting for approval.');
      console.log('Generate and validate content first:  npm run generate && npm run validate');
      closeDb();
      return;
    }
    console.log(`\n${waiting.length} post(s) waiting for approval:\n`);
    for (const post of waiting) {
      console.log(
        `  ${post.id.padEnd(46)} ${post.pillar.padEnd(12)} ${post.audience.padEnd(4)} ${post.platform.padEnd(10)} ${String(post.caption || '').slice(0, 48).replace(/\n/g, ' ')}`,
      );
    }
    console.log('\nReview one in full:  npm run approve -- --id <post id>');
    console.log('Approve everything:   npm run approve -- --all');
    closeDb();
    return;
  }

  const posts = args.all
    ? listPosts({ state: STATES.VALIDATED })
    : [listPosts({ id: args.id })[0]].filter(Boolean);

  if (!posts.length) {
    console.error(args.id ? `No post with id "${args.id}".` : 'Nothing to approve.');
    closeDb();
    process.exit(1);
  }

  for (const post of posts) {
    if (post.state !== STATES.VALIDATED) {
      console.error(`  ${post.id} is ${post.state}, not VALIDATED - it cannot be approved.`);
      continue;
    }
    if (!args.all) console.log(printPost(post));

    const to = args.reject ? STATES.REJECTED : STATES.APPROVED;
    assertTransition(post.state, to);
    updatePost(post.id, { state: to, error: null });
    recordEvent(post.id, post.state, to, args.reject ? 'reviewer' : 'reviewer', args.reject ? 'rejected' : 'approved');
    moveDraftFile(post, args.reject ? 'rejected' : 'approved');
    console.log(`  ${post.id} -> ${to}`);
  }

  console.log('\nNext: npm run schedule');
  closeDb();
}

main();
