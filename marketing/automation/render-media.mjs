#!/usr/bin/env node
/**
 * Renders the media a post needs before it can be scheduled.
 *
 * A carousel, a reel or a story cannot be scheduled without its media -
 * Instagram and Facebook want files, and the engine only produces copy. This
 * turns a post's script into the files the platform needs and writes the
 * paths back onto the post, so the scheduler finds them later.
 *
 * The rendering is deterministic: the same post renders the same files. The
 * script skips a post whose media is already on disk unless --force is given.
 *
 *   node automation/render-media.mjs [--id <post id>] [--state VALIDATED]
 *                                     [--all] [--force] [--dry-run]
 */
import { env } from '../lib/config.mjs';
import { listPosts, updatePost, recordEvent, closeDb } from '../lib/db.mjs';
import { STATES } from '../lib/state.mjs';
import { renderPost, planPost } from '../lib/render.mjs';

/** The formats that cannot go out without a rendered file. */
const FORMATS_NEEDING_MEDIA = new Set(['reel', 'carousel', 'story']);

function parseArgs(argv) {
  const args = { id: null, state: STATES.VALIDATED, all: false, force: false, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--id') args.id = argv[++i];
    else if (key === '--state') args.state = argv[++i];
    else if (key === '--all') args.all = true;
    else if (key === '--force') args.force = true;
    else if (key === '--dry-run') args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  let posts;
  if (args.id) {
    posts = listPosts({}).filter((p) => p.id === args.id);
    if (!posts.length) {
      console.error(`No post with id "${args.id}".`);
      closeDb();
      process.exit(1);
    }
  } else if (args.all) {
    posts = listPosts({});
  } else {
    posts = listPosts({ state: args.state });
  }

  const renderable = posts.filter((p) => FORMATS_NEEDING_MEDIA.has(p.format));
  const skipped = posts.length - renderable.length;
  if (skipped) console.log(`${skipped} post(s) need no media.`);

  if (!renderable.length) {
    console.log('Nothing to render.');
    closeDb();
    return;
  }

  let rendered = 0;
  let failed = 0;

  for (const post of renderable) {
    try {
      if (args.dryRun) {
        const plan = planPost(post, { assetsDir: env.assetsDir });
        const names = plan.media.map((m) => m.path).join(', ');
        console.log(`  ${post.id} (${post.format}) -> ${names}`);
        rendered += 1;
        continue;
      }

      const { media } = await renderPost(post, {
        assetsDir: env.assetsDir,
        force: args.force,
      });

      updatePost(post.id, { media });
      recordEvent(post.id, post.state, post.state, 'renderer', `rendered ${media.length} file(s)`);

      const names = media.map((m) => m.path).join(', ');
      console.log(`  ${post.id} (${post.format}) -> ${names}`);
      rendered += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ${post.id}: FAILED - ${err.message}`);
    }
  }

  if (args.dryRun) {
    console.log(`\n${rendered} would be rendered, ${failed} failed. Nothing was written.`);
  } else {
    console.log(`\n${rendered} rendered, ${failed} failed.`);
  }
  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
