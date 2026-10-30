import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, captionSimilarity, isNearDuplicate, normaliseText } from '../lib/dedupe.mjs';

test('the same creative gets the same fingerprint', () => {
  const a = fingerprint({ title: 'Athens - Wedding DJs', landingPath: '/vendors/category/wedding_dj', pillar: 'discovery', audience: 'el' });
  const b = fingerprint({ title: 'Athens - Wedding DJs', landingPath: '/vendors/category/wedding_dj', pillar: 'discovery', audience: 'el' });
  assert.equal(a, b);
});

test('a different landing page gets a different fingerprint', () => {
  const a = fingerprint({ title: 'Athens - Wedding DJs', landingPath: '/vendors/category/wedding_dj', pillar: 'discovery', audience: 'el' });
  const b = fingerprint({ title: 'Athens - Wedding DJs', landingPath: '/vendors/category/wedding_photographer', pillar: 'discovery', audience: 'el' });
  assert.notEqual(a, b);
});

test('a different audience gets a different fingerprint', () => {
  const a = fingerprint({ title: 'Athens', landingPath: '/vendors/location/athens', pillar: 'inspiration', audience: 'el' });
  const b = fingerprint({ title: 'Athens', landingPath: '/vendors/location/athens', pillar: 'inspiration', audience: 'en' });
  assert.notEqual(a, b);
});

test('normalisation drops urls and hashtags', () => {
  const normalised = normaliseText('Hello there #Wedding https://weddingwise.gr/vendors !!!');
  assert.equal(normalised, 'hello there');
});

test('similar captions score high', () => {
  const a = 'Discover five photographers in Athens for your wedding photography';
  const b = 'Discover five photographers in Athens for your wedding photography today';
  assert.ok(captionSimilarity(a, b) > 0.8);
});

test('different captions score low', () => {
  const a = 'Discover five photographers in Athens for your wedding photography';
  const b = 'How to choose a wedding venue on an island in Greece';
  assert.ok(captionSimilarity(a, b) < 0.3);
});

test('near duplicates are detected', () => {
  const caption = 'Discover five photographers in Athens for your wedding photography';
  const existing = [{ caption: 'Discover five photographers in Athens for your wedding photography' }];
  assert.equal(isNearDuplicate(caption, existing), true);
  assert.equal(isNearDuplicate(caption, [{ caption: 'Completely different text about menus and cakes' }]), false);
});
