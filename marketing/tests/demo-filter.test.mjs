import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDemoRecord, filterDemoRecords } from '../lib/demo-filter.mjs';

/**
 * The WeddingWise production database still carries the demo seed rows. If one
 * of them reached a caption, the account would be publishing fabricated
 * ratings for a business that does not exist.
 */

test('a known demo slug is excluded', () => {
  assert.equal(isDemoRecord({ slug: 'demo-cliffside-venue' }), true);
  assert.equal(isDemoRecord({ slug: 'aegean-photography' }), true);
  assert.equal(isDemoRecord({ slug: 'demo-elena-k-photography' }), true);
});

test('anything prefixed demo- is excluded', () => {
  assert.equal(isDemoRecord({ slug: 'demo-anything-at-all' }), true);
});

test('a repeated seed uuid is excluded', () => {
  assert.equal(isDemoRecord({ id: 'abababab-1111-4111-8111-111111111111' }), true);
  assert.equal(isDemoRecord({ id: '55555555-2222-4333-8444-555555555555' }), true);
  assert.equal(isDemoRecord({ id: 'c1c1c1c1-2222-4333-8444-555555555555' }), true);
});

test('a random uuid is not excluded by the id check', () => {
  assert.equal(
    isDemoRecord({ id: '3f9a7c21-4b8e-4d1a-9f3c-7e2b5d6a1c04', slug: 'real-vendor' }),
    false,
  );
});

test('a demo business name is excluded even under another slug', () => {
  assert.equal(isDemoRecord({ slug: 'some-other-slug', businessName: 'Cliffside Venue' }), true);
  assert.equal(isDemoRecord({ slug: 'x', businessName: 'aegean photography' }), true);
});

test('a real vendor is kept', () => {
  const vendor = {
    id: '3f9a7c21-4b8e-4d1a-9f3c-7e2b5d6a1c04',
    slug: 'studio-nika',
    businessName: 'Studio Nika',
  };
  assert.equal(isDemoRecord(vendor), false);
});

test('an extra slug from the environment is excluded', () => {
  process.env.WW_DEMO_SLUG_BLOCKLIST = 'another-seed-record, third-seed';
  try {
    assert.equal(isDemoRecord({ slug: 'another-seed-record' }), true);
    assert.equal(isDemoRecord({ slug: 'third-seed' }), true);
    assert.equal(isDemoRecord({ slug: 'not-blocked' }), false);
  } finally {
    delete process.env.WW_DEMO_SLUG_BLOCKLIST;
  }
});

test('filtering reports what it dropped', () => {
  const { kept, dropped } = filterDemoRecords([
    { slug: 'real-one' },
    { slug: 'demo-real-two' },
    { slug: 'real-three' },
  ]);
  assert.deepEqual(kept.map((v) => v.slug), ['real-one', 'real-three']);
  assert.deepEqual(dropped.map((v) => v.slug), ['demo-real-two']);
});

test('strict mode turns a missed demo record into an error', () => {
  process.env.WW_DEMO_STRICT = '1';
  try {
    assert.throws(
      () => filterDemoRecords([{ slug: 'demo-something' }]),
      /data-hygiene problem/,
    );
  } finally {
    delete process.env.WW_DEMO_STRICT;
  }
});

test('strict mode does not fire when there is nothing to drop', () => {
  process.env.WW_DEMO_STRICT = '1';
  try {
    const { kept } = filterDemoRecords([{ slug: 'real-one' }]);
    assert.equal(kept.length, 1);
  } finally {
    delete process.env.WW_DEMO_STRICT;
  }
});
