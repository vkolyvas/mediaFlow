import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, formatInZone } from '../lib/time.mjs';

/**
 * Athens is UTC+3 in summer and UTC+2 in winter. Getting this wrong means a
 * post published at 03:00 local, so the conversion is tested on both sides of
 * the daylight-saving boundary.
 */

const ATHENS = 'Europe/Athens';

test('a summer evening in Athens is three hours ahead of UTC', () => {
  const instant = zonedToUtc('2026-07-14', 18, 30, ATHENS);
  assert.equal(instant.toISOString(), '2026-07-14T15:30:00.000Z');
});

test('a winter evening in Athens is two hours ahead of UTC', () => {
  const instant = zonedToUtc('2026-11-17', 18, 30, ATHENS);
  assert.equal(instant.toISOString(), '2026-11-17T16:30:00.000Z');
});

test('the offset changes across the daylight-saving boundary', () => {
  // EU summer time ends on the last Sunday of October: 25 October 2026.
  const before = zonedToUtc('2026-10-24', 12, 0, ATHENS);
  const after = zonedToUtc('2026-10-26', 12, 0, ATHENS);
  assert.equal(before.toISOString(), '2026-10-24T09:00:00.000Z');
  assert.equal(after.toISOString(), '2026-10-26T10:00:00.000Z');
});

test('the offset changes across the spring boundary too', () => {
  // EU summer time starts on the last Sunday of March: 29 March 2026.
  const before = zonedToUtc('2026-03-28', 12, 0, ATHENS);
  const after = zonedToUtc('2026-03-30', 12, 0, ATHENS);
  assert.equal(before.toISOString(), '2026-03-28T10:00:00.000Z');
  assert.equal(after.toISOString(), '2026-03-30T09:00:00.000Z');
});

test('a midnight slot in Athens is the previous day in UTC', () => {
  const instant = zonedToUtc('2026-07-14', 0, 0, ATHENS);
  assert.equal(instant.toISOString(), '2026-07-13T21:00:00.000Z');
});

test('a slot that does not exist on a spring-forward day lands on the hour', () => {
  // 2026-03-29 03:00 local does not exist in Athens; the clock jumps from
  // 02:59 to 03:01. The conversion must still produce a usable instant.
  const instant = zonedToUtc('2026-03-29', 3, 0, ATHENS);
  assert.ok(!Number.isNaN(instant.getTime()));
  assert.equal(instant.toISOString(), '2026-03-29T01:00:00.000Z');
});

test('an instant is formatted back into the local time', () => {
  const instant = zonedToUtc('2026-07-14', 18, 30, ATHENS);
  const formatted = formatInZone(instant, ATHENS);
  assert.match(formatted, /14 Jul 2026/);
  assert.match(formatted, /18:30/);
});
