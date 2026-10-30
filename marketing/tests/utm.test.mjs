import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUtmCampaign, buildTrackedUrl, parseUtm, slugify, platformFromUtmContent } from '../lib/utm.mjs';

test('a campaign name is stable and ASCII', () => {
  const name = buildUtmCampaign({
    audience: 'greek',
    pillar: 'discovery',
    target: 'athina-wedding_photographer',
    date: '2026-11-03',
  });
  assert.equal(name, 'ww_greek_discovery_athina-wedding-photographer_20261103');
  assert.match(name, /^[a-z0-9_-]+$/);
});

test('a campaign name survives a Greek target', () => {
  const name = buildUtmCampaign({
    audience: 'greek',
    pillar: 'discovery',
    target: 'Αθήνα - Εξοπλισμός γάμου',
    date: '2026-11-03',
  });
  assert.match(name, /^[a-z0-9_-]+$/);
  assert.match(name, /^ww_greek_discovery/);
});

test('a truncated slug does not end mid-word', () => {
  const slug = slugify('international-destination-couples', { max: 22 });
  assert.equal(slug, 'international');
  assert.doesNotMatch(slug, /-$/);
});

test('a tracked url carries every utm parameter', () => {
  const url = buildTrackedUrl({
    path: '/vendors/location/athens/wedding_dj',
    campaign: 'ww_greek_discovery_athina-wedding_dj_20261103',
    platform: 'instagram',
    fingerprint: 'abcdef1234567890',
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, 'https://weddingwise.gr/vendors/location/athens/wedding_dj');
  assert.equal(parsed.searchParams.get('utm_source'), 'weddingwise');
  assert.equal(parsed.searchParams.get('utm_medium'), 'social');
  assert.equal(parsed.searchParams.get('utm_campaign'), 'ww_greek_discovery_athina-wedding_dj_20261103');
  assert.equal(parsed.searchParams.get('utm_content'), 'instagram_abcdef12');
});

test('a tracked url round-trips', () => {
  const url = buildTrackedUrl({
    path: '/signup',
    campaign: 'ww_greek_product_product_20261105',
    platform: 'facebook',
    fingerprint: 'deadbeefcafe0000',
  });
  const utm = parseUtm(url);
  assert.equal(utm.campaign, 'ww_greek_product_product_20261105');
  assert.equal(utm.source, 'weddingwise');
  assert.equal(utm.medium, 'social');
  assert.equal(platformFromUtmContent(utm.content), 'facebook');
});

test('an absolute path is left alone', () => {
  const url = buildTrackedUrl({
    path: 'https://weddingwise.gr/vendors',
    campaign: 'c',
    platform: 'instagram',
    fingerprint: 'f',
  });
  assert.match(url, /^https:\/\/weddingwise\.gr\/vendors\?/);
});

test('parsing rubbish does not throw', () => {
  const utm = parseUtm('not a url');
  assert.equal(utm.campaign, null);
});
