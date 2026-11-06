/**
 * Reconciling the local state with the publisher.
 *
 * Postiz holds the truth about whether a post went out. Nothing calls us
 * when it does, so the collector asks, and the answer is written back here.
 *
 * Postiz reports a post as QUEUE, PUBLISHED, ERROR or DRAFT. Only the first
 * two change anything for us: a queued post is still on its way, and a draft
 * was never scheduled.
 */
import { updatePost, recordEvent } from './db.mjs';
import { STATES } from './state.mjs';

/**
 * What Postiz's state means for a post of ours.
 *
 * Returns null when nothing has changed - the post is still on its way.
 */
export function outcomeFromPostiz(live) {
  const state = String(live?.state || '').toUpperCase();
  if (state === 'PUBLISHED') {
    return {
      state: STATES.PUBLISHED,
      publishedAt: live.publishDate || null,
      error: null,
      note: `postiz ${live.id} published`,
    };
  }
  if (state === 'ERROR') {
    return {
      state: STATES.FAILED,
      error: live.error || 'postiz could not publish the post',
      note: live.error || 'postiz could not publish the post',
    };
  }
  return null;
}

/**
 * Writes the outcome onto the post and records the move.
 *
 * Returns true when the post changed state.
 */
export function applyPostizState(post, live) {
  const outcome = outcomeFromPostiz(live);
  if (!outcome) return false;

  const fields = { state: outcome.state, error: outcome.error ?? null };
  if (outcome.state === STATES.PUBLISHED) {
    fields.publishedAt = outcome.publishedAt || new Date().toISOString();
  }

  updatePost(post.id, fields);
  recordEvent(post.id, post.state, outcome.state, 'collector', outcome.note);
  return true;
}
