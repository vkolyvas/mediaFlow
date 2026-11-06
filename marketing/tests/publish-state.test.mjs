import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDb } from './helpers.mjs';

useTempDb();

const { insertPost, getPost, listEvents } = await import('../lib/db.mjs');
const { outcomeFromPostiz, applyPostizState } = await import('../lib/publish-state.mjs');
const { STATES } = await import('../lib/state.mjs');

test('a post Postiz has published becomes published here', () => {
  insertPost({
    id: 'p_published',
    pillar: 'guides',
    audience: 'en',
    platform: 'instagram',
    format: 'carousel',
    state: STATES.SCHEDULED,
    title: 'A post',
    postizPostId: 'postiz_1',
    scheduledAt: '2026-11-30T08:30:00.000Z',
  });

  const changed = applyPostizState(getPost('p_published'), {
    id: 'postiz_1',
    state: 'PUBLISHED',
    publishDate: '2026-11-30T08:31:00.000Z',
  });

  assert.equal(changed, true);
  const post = getPost('p_published');
  assert.equal(post.state, STATES.PUBLISHED);
  assert.equal(post.published_at, '2026-11-30T08:31:00.000Z');
  assert.equal(post.error, null);
});

test('a post Postiz could not publish fails, and says why', () => {
  insertPost({
    id: 'p_failed',
    pillar: 'guides',
    audience: 'en',
    platform: 'instagram',
    format: 'carousel',
    state: STATES.SCHEDULED,
    title: 'A post',
    postizPostId: 'postiz_2',
    scheduledAt: '2026-11-30T08:30:00.000Z',
  });

  applyPostizState(getPost('p_failed'), {
    id: 'postiz_2',
    state: 'ERROR',
    error: 'instagram refused the media',
  });

  const post = getPost('p_failed');
  assert.equal(post.state, STATES.FAILED);
  assert.equal(post.error, 'instagram refused the media');
});

test('a post still in the queue stays scheduled', () => {
  insertPost({
    id: 'p_queued',
    pillar: 'guides',
    audience: 'en',
    platform: 'instagram',
    format: 'carousel',
    state: STATES.SCHEDULED,
    title: 'A post',
    postizPostId: 'postiz_3',
    scheduledAt: '2026-11-30T08:30:00.000Z',
  });

  const changed = applyPostizState(getPost('p_queued'), { id: 'postiz_3', state: 'QUEUE' });

  assert.equal(changed, false);
  assert.equal(getPost('p_queued').state, STATES.SCHEDULED);
});

test('the move is recorded in the post history', () => {
  const events = listEvents('p_published');
  const last = events[events.length - 1];
  assert.equal(last.from_state, STATES.SCHEDULED);
  assert.equal(last.to_state, STATES.PUBLISHED);
  assert.equal(last.actor, 'collector');
});

test('a post Postiz says nothing about is not moved', () => {
  assert.equal(outcomeFromPostiz(undefined), null);
  assert.equal(outcomeFromPostiz({ state: 'DRAFT' }), null);
});
