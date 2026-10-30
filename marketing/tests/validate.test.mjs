import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDb } from './helpers.mjs';

useTempDb();

const { validatePost } = await import('../lib/validate.mjs');

function post(overrides = {}) {
  return {
    id: 'p_test_1',
    campaignId: 'c_test_1',
    pillar: 'discovery',
    audience: 'en',
    platform: 'instagram',
    format: 'carousel',
    state: 'GENERATED',
    title: 'Athens - Wedding DJs',
    caption: '',
    hashtags: [],
    cta: '',
    link_url: null,
    utm_url: 'https://weddingwise.gr/vendors/category/wedding_dj?utm_source=weddingwise&utm_medium=social&utm_campaign=c&utm_content=instagram_1',
    landing_path: '/vendors/category/wedding_dj',
    script: { slides: [{ headline: 'a', body: 'b' }], shotList: [] },
    media: [],
    visual_brief: 'A typographic composition in rose and champagne.',
    vendor_refs: [],
    fingerprint: 'fp_test_1',
    ...overrides,
  };
}

const REFS = [
  {
    slug: 'tselinatseliou',
    businessName: 'Tselinatseliou',
    ratingAverage: 4.7,
    ratingCount: 38,
    claimed: true,
  },
];

async function validate(overrides = {}, options = {}) {
  return validatePost(post(overrides), {
    allPosts: [],
    checkNetwork: false,
    checkVendors: false,
    ...options,
  });
}

function codes(result) {
  return result.findings.map((f) => f.code);
}

test('a clean post passes', async () => {
  const result = await validate({
    caption: 'Discover five wedding DJs in Athens to discover for your celebration.',
    vendor_refs: REFS,
  });
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});

test('an empty caption fails', async () => {
  const result = await validate({ caption: '' });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('empty_caption'));
});

test('a Greek post written in English fails', async () => {
  const result = await validate({
    audience: 'el',
    caption: 'Discover five wedding DJs in Athens for your celebration and your music tonight.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('wrong_language'));
});

test('an English post written in Greek fails', async () => {
  const result = await validate({
    audience: 'en',
    caption: 'Ανακαλύψτε πέντε DJ γάμου στην Αθήνα για την ημέρα σας με πολλή αγάπη και χαρά.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('wrong_language'));
});

test('a superlative next to a vendor fails', async () => {
  const result = await validate({
    caption: 'Tselinatseliou is the best wedding DJ in Athens, with a rating of 4.7 from 38 reviews.',
    vendor_refs: REFS,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('superlative_claim'));
});

test('a superlative that is advice, not a claim, is allowed', async () => {
  const result = await validate({
    caption: 'How do you find the best wedding DJ? Start by looking at real ratings and a real portfolio.',
    vendor_refs: REFS,
  });
  assert.ok(!codes(result).includes('superlative_claim'));
});

test('a rating that belongs to nobody fails', async () => {
  const result = await validate({
    caption: 'Tselinatseliou has a rating of 4.9 from 38 reviews.',
    vendor_refs: REFS,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('fabricated_rating'));
});

test('a rating that matches the data passes', async () => {
  const result = await validate({
    caption: 'Tselinatseliou has a rating of 4.7 from 38 reviews.',
    vendor_refs: REFS,
  });
  assert.ok(!codes(result).includes('fabricated_rating'));
});

test('a review count that belongs to nobody fails', async () => {
  const result = await validate({
    caption: 'Tselinatseliou has a rating of 4.7 from 512 reviews.',
    vendor_refs: REFS,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('fabricated_review_count'));
});

test('implying a partnership fails', async () => {
  const result = await validate({
    caption: 'Tselinatseliou is our partner for weddings in Athens and the team loves the music.',
    vendor_refs: REFS,
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('endorsement_claim'));
});

test('presenting an unclaimed vendor as ours fails', async () => {
  const result = await validate({
    caption: 'Tselinatseliou is our partner and our official DJ in Athens for every celebration.',
    vendor_refs: [{ ...REFS[0], claimed: false }],
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('endorsement_claim'));
});

test('a missing link fails where one is required', async () => {
  const result = await validate({
    pillar: 'discovery',
    utm_url: null,
    caption: 'Discover five wedding DJs in Athens for your celebration today.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('missing_link'));
});

test('a link without utm parameters fails', async () => {
  const result = await validate({
    utm_url: 'https://weddingwise.gr/vendors/category/wedding_dj',
    caption: 'Discover five wedding DJs in Athens for your celebration today.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('missing_utm'));
});

test('a carousel without slides fails', async () => {
  const result = await validate({
    format: 'carousel',
    script: { slides: [], shotList: [] },
    caption: 'Discover five wedding DJs in Athens for your celebration today.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('missing_slides'));
});

test('a reel without a shot list fails', async () => {
  const result = await validate({
    format: 'reel',
    script: { slides: [], shotList: [] },
    caption: 'Discover five wedding DJs in Athens for your celebration today.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('missing_shot_list'));
});

test('a post without a visual brief fails', async () => {
  const result = await validate({
    visual_brief: '',
    caption: 'Discover five wedding DJs in Athens for your celebration today.',
  });
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('missing_visual_brief'));
});

test('the same creative already scheduled is a duplicate', async () => {
  const existing = [
    {
      id: 'p_other',
      fingerprint: 'fp_test_1',
      state: 'SCHEDULED',
      caption: 'Discover five wedding DJs in Athens for your celebration today.',
    },
  ];
  const result = await validate(
    { caption: 'Discover five wedding DJs in Athens for your celebration today.' },
    { allPosts: existing },
  );
  assert.equal(result.ok, false);
  assert.ok(codes(result).includes('duplicate_content'));
});

test('engagement posts do not need a link', async () => {
  const result = await validate({
    pillar: 'engagement',
    utm_url: null,
    landing_path: null,
    format: 'reel',
    script: { slides: [], shotList: [{ visual: 'a' }] },
    caption: 'Island wedding or countryside wedding? Tell us in the comments which one you choose.',
  });
  assert.equal(result.ok, true, JSON.stringify(result.findings, null, 2));
});
