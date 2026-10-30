#!/usr/bin/env node
/**
 * Where everything stands.
 *
 * One screen that answers "what needs me right now" - the queue by state, the
 * scheduled posts, and whether the tracking plumbing is actually working.
 *
 *   node automation/status.mjs
 */
import { all, listPosts, closeDb } from '../lib/db.mjs';
import { STATES } from '../lib/state.mjs';

function countByState() {
  const rows = all('SELECT state, COUNT(*) AS count FROM posts GROUP BY state');
  const counts = {};
  for (const state of Object.values(STATES)) counts[state] = 0;
  for (const row of rows) counts[row.state] = row.count;
  return counts;
}

function main() {
  const counts = countByState();
  const posts = listPosts({});

  console.log('\nPipeline\n');
  for (const state of Object.values(STATES)) {
    const count = counts[state] || 0;
    const bar = count ? 'x'.repeat(Math.min(count, 40)) : '';
    console.log(`  ${state.padEnd(11)} ${String(count).padStart(4)}  ${bar}`);
  }

  const needsMe = posts.filter((p) => p.state === STATES.VALIDATED);
  if (needsMe.length) {
    console.log(`\n${needsMe.length} post(s) waiting for your approval:`);
    for (const post of needsMe.slice(0, 10)) {
      console.log(
        `  ${post.id.padEnd(46)} ${post.pillar.padEnd(12)} ${post.audience.padEnd(4)} ${post.platform.padEnd(10)} ${String(post.caption || '').slice(0, 44).replace(/\n/g, ' ')}`,
      );
    }
    console.log('\nReview them:  npm run approve -- --id <post id>');
  }

  const upcoming = posts
    .filter((p) => p.state === STATES.SCHEDULED && p.scheduled_at)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  if (upcoming.length) {
    console.log(`\n${upcoming.length} post(s) scheduled:`);
    for (const post of upcoming.slice(0, 10)) {
      console.log(`  ${post.scheduled_at}  ${post.platform.padEnd(10)} ${post.id}`);
    }
  }

  const failed = posts.filter((p) => p.state === STATES.FAILED);
  if (failed.length) {
    console.log(`\n${failed.length} post(s) failed:`);
    for (const post of failed.slice(0, 10)) {
      console.log(`  ${post.id}  ${post.error || 'no error recorded'}`);
    }
  }

  const metrics = all('SELECT COUNT(*) AS count FROM metrics')[0]?.count || 0;
  const conversions = all('SELECT COUNT(*) AS count FROM conversions')[0]?.count || 0;
  console.log(`\nTracking: ${metrics} metric snapshot(s), ${conversions} conversion(s).`);
  if (!metrics || !conversions) {
    console.log(
      '  Conversions stay at zero until the app-side UTM capture is deployed. ' +
        'Without it the report can rank reach but cannot rank registrations.',
    );
  }
  console.log('');
}

main();
closeDb();
