import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryLabel,
  categoryLabelLower,
  categoryLabelEl,
  locationLabel,
  locationSlug,
  categoryPath,
  locationPath,
  combinationPath,
  registrationPath,
  directoryPath,
  isCategoryIndexable,
  isLocationIndexable,
  isCombinationIndexable,
  chooseLandingPage,
  MIN_LISTINGS_FOR_INDEX,
  MIN_LISTINGS_FOR_LOCATION_INDEX,
  MIN_LISTINGS_FOR_COMBINATION_INDEX,
} from '../lib/seo-pages.mjs';

test('a category label is pluralised', () => {
  assert.equal(categoryLabel('wedding_photographer', 'Wedding Photographer'), 'Wedding Photographers');
  assert.equal(categoryLabel('wedding_florist', 'Wedding Florist'), 'Wedding Florists');
  assert.equal(categoryLabel('some_category', 'Category'), 'Categories');
});

test('a plural override wins over the naive plural', () => {
  assert.equal(categoryLabel('wedding_catering', 'Wedding Catering'), 'Wedding Catering');
  assert.equal(categoryLabel('wedding_transportation', 'Wedding Transportation'), 'Wedding Transportation');
  assert.equal(categoryLabel('wedding_hair_makeup', 'Wedding Hair & Makeup'), 'Hair & Makeup Artists');
});

test('a label used mid-sentence keeps its acronyms', () => {
  assert.equal(categoryLabelLower('wedding_dj', 'Wedding DJ'), 'wedding DJs');
  assert.equal(categoryLabelLower('wedding_photographer', 'Wedding Photographer'), 'wedding photographers');
});

test('the Greek label comes from the locale file', () => {
  assert.equal(categoryLabelEl('wedding_photographer', 'Wedding Photographer'), 'Φωτογράφοι γάμου');
  assert.equal(categoryLabelEl('wedding_dj', 'Wedding DJ'), 'DJ γάμου');
  assert.equal(categoryLabelEl('wedding_florist', 'Wedding Florist'), 'Ανθοδιακομίστες');
});

test('an unknown category falls back to the English label', () => {
  assert.equal(categoryLabelEl('not_a_category', 'Something'), 'Somethings');
});

test('a curated place has an English name and a URL slug', () => {
  assert.equal(locationLabel('thira', 'ΘΗΡΑ', 'en'), 'Santorini');
  assert.equal(locationSlug('thira'), 'santorini');
  assert.equal(locationSlug('kerkyra'), 'corfu');
  assert.equal(locationSlug('naxos-kai-mikres-kyklades'), 'naxos');
});

test('a Greek place name comes from the locale file', () => {
  assert.equal(locationLabel('athina', 'ΑΘΗΝΑ', 'el'), 'Αθήνα');
});

test('an uncurated place keeps its registry slug in the URL', () => {
  assert.equal(locationSlug('some_new_place'), 'some_new_place');
});

test('the landing page paths match the site', () => {
  assert.equal(categoryPath('wedding_photographer'), '/vendors/category/wedding_photographer');
  assert.equal(locationPath('thira'), '/vendors/location/santorini');
  assert.equal(combinationPath('thira', 'wedding_florist'), '/vendors/location/santorini/wedding_florist');
  assert.equal(registrationPath(), '/signup');
  assert.equal(directoryPath(), '/vendors');
});

test('the index floors are the ones the site uses', () => {
  assert.equal(MIN_LISTINGS_FOR_INDEX, 10);
  assert.equal(MIN_LISTINGS_FOR_LOCATION_INDEX, 15);
  assert.equal(MIN_LISTINGS_FOR_COMBINATION_INDEX, 10);
});

test('a thin page is not indexable', () => {
  assert.equal(isCategoryIndexable({ vendorCount: 9 }), false);
  assert.equal(isCategoryIndexable({ vendorCount: 10 }), true);
  assert.equal(isLocationIndexable({ vendorCount: 14 }), false);
  assert.equal(isLocationIndexable({ vendorCount: 15 }), true);
  assert.equal(isCombinationIndexable({ types: [{ slug: 'wedding_dj', count: 12 }] }, 'wedding_dj'), true);
  assert.equal(isCombinationIndexable({ types: [{ slug: 'wedding_dj', count: 3 }] }, 'wedding_dj'), false);
});

test('the most specific page with inventory is chosen', () => {
  const location = {
    slug: 'thira',
    name: 'ΘΗΡΑ',
    vendorCount: 40,
    types: [{ slug: 'wedding_florist', count: 14 }],
  };
  const category = { slug: 'wedding_florist', name: 'Wedding Florist', vendorCount: 120 };

  const page = chooseLandingPage({ location, category, audience: 'en' });
  assert.equal(page.kind, 'combination');
  assert.equal(page.path, '/vendors/location/santorini/wedding_florist');
});

test('a thin combination falls back to the place page', () => {
  const location = {
    slug: 'thira',
    name: 'ΘΗΡΑ',
    vendorCount: 40,
    types: [{ slug: 'wedding_florist', count: 2 }],
  };
  const category = { slug: 'wedding_florist', name: 'Wedding Florist', vendorCount: 120 };

  const page = chooseLandingPage({ location, category, audience: 'en' });
  assert.equal(page.kind, 'location');
  assert.equal(page.path, '/vendors/location/santorini');
});

test('a thin place falls back to the category page', () => {
  const location = { slug: 'thira', name: 'ΘΗΡΑ', vendorCount: 3, types: [] };
  const category = { slug: 'wedding_florist', name: 'Wedding Florist', vendorCount: 120 };

  const page = chooseLandingPage({ location, category, audience: 'en' });
  assert.equal(page.kind, 'category');
  assert.equal(page.path, '/vendors/category/wedding_florist');
});

test('nothing with inventory falls back to the directory', () => {
  const page = chooseLandingPage({});
  assert.equal(page.kind, 'directory');
  assert.equal(page.path, '/vendors');
});

test('the directory label is in the audience language', () => {
  assert.equal(chooseLandingPage({ audience: 'el' }).label, 'Ο κατάλογος επαγγελματιών');
  assert.equal(chooseLandingPage({ audience: 'en' }).label, 'The vendor directory');
});
