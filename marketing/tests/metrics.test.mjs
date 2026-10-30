import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseMetrics, metricDate, rate } from '../lib/metrics.mjs';

test('a flat provider payload is read as-is', () => {
  const totals = normaliseMetrics({
    reach: 1000,
    impressions: 2500,
    likes: 80,
    comments: 4,
    shares: 12,
    saves: 30,
    clicks: 45,
    profile_visits: 90,
  });
  assert.equal(totals.reach, 1000);
  assert.equal(totals.impressions, 2500);
  assert.equal(totals.likes, 80);
  assert.equal(totals.clicks, 45);
  assert.equal(totals.profileVisits, 90);
});

test('a provider that nests its numbers under a series is found', () => {
  const totals = normaliseMetrics({
    data: [{ date: '2026-11-03', impressions: 100, likes: 5 }],
  });
  assert.equal(totals.impressions, 100);
  assert.equal(totals.likes, 5);
});

test('provider aliases are recognised', () => {
  const totals = normaliseMetrics({
    accounts_reached: 400,
    link_clicks: 22,
    bookmarks: 9,
    reactions: 31,
    reposts: 4,
  });
  assert.equal(totals.reach, 400);
  assert.equal(totals.clicks, 22);
  assert.equal(totals.saves, 9);
  assert.equal(totals.likes, 31);
  assert.equal(totals.shares, 4);
});

test('a string number is parsed', () => {
  const totals = normaliseMetrics({ impressions: '1,204' });
  assert.equal(totals.impressions, 1204);
});

test('an unknown field is ignored, never guessed at', () => {
  const totals = normaliseMetrics({ followers: 5000, impressions: 10 });
  assert.equal(totals.impressions, 10);
  assert.equal(Object.keys(totals).length, 8);
  assert.equal(totals.likes, 0);
});

test('the same metric at two depths is counted once', () => {
  // A provider that returns both a total and a series would otherwise be
  // double counted. The shallowest level wins.
  const totals = normaliseMetrics({
    impressions: 500,
    series: { impressions: 500 },
  });
  assert.equal(totals.impressions, 500);
});

test('a metric nested under an aggregate key is found', () => {
  const totals = normaliseMetrics({
    impressions: { total: 500 },
    reach: { value: 300 },
  });
  assert.equal(totals.impressions, 500);
  assert.equal(totals.reach, 300);
});

test('a nested provider shape does not blow up', () => {
  const totals = normaliseMetrics({
    a: { b: { c: { d: { e: { f: { g: { h: { i: { impressions: 7 } } } } } } } } },
  });
  assert.equal(totals.impressions, 0);
});

test('the metric date is read from the payload', () => {
  const date = metricDate({ date: '2026-11-03' });
  assert.equal(date, '2026-11-03');
});

test('the latest date in the payload wins', () => {
  const date = metricDate([
    { date: '2026-11-01' },
    { date: '2026-11-05' },
  ]);
  assert.equal(date, '2026-11-05');
});

test('a payload with no date falls back', () => {
  const fallback = new Date('2026-11-09T00:00:00Z');
  assert.equal(metricDate({ impressions: 5 }, fallback), '2026-11-09');
});

test('a rate never divides by zero', () => {
  assert.equal(rate(10, 0), 0);
  assert.equal(rate(0, 100), 0);
});

test('a rate is a rounded percentage', () => {
  assert.equal(rate(1, 3), 33.33);
  assert.equal(rate(1, 4), 25);
});
