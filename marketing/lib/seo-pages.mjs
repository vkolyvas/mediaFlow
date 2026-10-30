import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './config.mjs';

/**
 * The WeddingWise landing-page vocabulary.
 *
 * The public site uses one URL scheme and one set of inventory thresholds. If
 * a social post links somewhere the site does not have, the post sends people
 * to a 404 - so this module mirrors the app's own rules rather than inventing
 * a second set:
 *
 *   frontend/src/lib/seo/categoryCopy.js
 *   frontend/src/lib/seo/locationCopy.js
 *   frontend/src/lib/seo/combinationCopy.js
 *
 * The counts are never written here. They always come from the live API.
 */

/** Registry slug -> the name and URL slug a landing page carries. */
export const CURATED_LOCATION_PAGES = Object.freeze({
  athina: { slug: 'athens', name: 'Athens' },
  thira: { slug: 'santorini', name: 'Santorini' },
  mykonos: { slug: 'mykonos', name: 'Mykonos' },
  thessaloniki: { slug: 'thessaloniki', name: 'Thessaloniki' },
  kerkyra: { slug: 'corfu', name: 'Corfu' },
  rodos: { slug: 'rhodes', name: 'Rhodes' },
  paros: { slug: 'paros', name: 'Paros' },
  zakynthos: { slug: 'zakynthos', name: 'Zakynthos' },
  kefalonia: { slug: 'kefalonia', name: 'Kefalonia' },
  'naxos-kai-mikres-kyklades': { slug: 'naxos', name: 'Naxos' },
  skiathos: { slug: 'skiathos', name: 'Skiathos' },
  tinos: { slug: 'tinos', name: 'Tinos' },
  lefkada: { slug: 'lefkada', name: 'Lefkada' },
});

/** Indexing floors, from the app's SEO modules. */
export const MIN_LISTINGS_FOR_INDEX = 10;
export const MIN_LISTINGS_FOR_LOCATION_INDEX = 15;
export const MIN_LISTINGS_FOR_COMBINATION_INDEX = 10;

const PLURAL_OVERRIDES = Object.freeze({
  wedding_catering: 'Wedding Catering',
  wedding_transportation: 'Wedding Transportation',
  wedding_equipment_rental: 'Wedding Equipment Rental',
  wedding_stationery: 'Wedding Stationery',
  wedding_gifts: 'Wedding Gifts',
  wedding_entertainment: 'Wedding Entertainment',
  wedding_lighting: 'Wedding Lighting',
  wedding_hair_makeup: 'Hair & Makeup Artists',
  wedding_makeup: 'Wedding Makeup Artists',
  wedding_jewelry: 'Wedding Jewelers',
});

const locales = JSON.parse(fs.readFileSync(path.join(PATHS.strategy, 'locales.json'), 'utf8'));

function pluralize(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.endsWith('ss')) return `${trimmed}es`;
  if (lower.endsWith('s')) return trimmed;
  if (/(ch|sh|x|z)$/.test(lower)) return `${trimmed}es`;
  if (/[^aeiou]y$/.test(lower)) return `${trimmed.slice(0, -1)}ies`;
  return `${trimmed}s`;
}

/** The English label a category page carries. */
export function categoryLabel(slug, name) {
  if (slug && PLURAL_OVERRIDES[slug]) return PLURAL_OVERRIDES[slug];
  return pluralize(name);
}

const ACRONYM_WORD = /^[A-Z]{2,}s?$/;

/** The same label mid-sentence: "wedding DJs". */
export function categoryLabelLower(slug, name) {
  const label = categoryLabel(slug, name);
  if (!label) return '';
  return label
    .split(' ')
    .map((word) => (ACRONYM_WORD.test(word) ? word : word.toLowerCase()))
    .join(' ');
}

/** The Greek label for a category, falling back to the English one. */
export function categoryLabelEl(slug, name) {
  return locales.categoryNames[slug] || categoryLabel(slug, name);
}

/** The display name of a place, for the requested audience. */
export function locationLabel(registrySlug, registryName, audience = 'en') {
  const curated = CURATED_LOCATION_PAGES[registrySlug];
  if (audience === 'el') {
    return locales.locationNames[registrySlug] || titleCase(registryName) || registrySlug;
  }
  return curated?.name || titleCase(registryName) || registrySlug;
}

/** The URL slug of a place page. */
export function locationSlug(registrySlug) {
  return CURATED_LOCATION_PAGES[registrySlug]?.slug || registrySlug;
}

function titleCase(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .split(/(\s+|-|\()/g)
    .map((part) => (/[\s\-()]/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/* -------------------------------------------------------------- paths */

export function categoryPath(categorySlug) {
  return `/vendors/category/${categorySlug}`;
}

export function locationPath(registrySlug) {
  return `/vendors/location/${locationSlug(registrySlug)}`;
}

export function combinationPath(registrySlug, categorySlug) {
  return `${locationPath(registrySlug)}/${categorySlug}`;
}

export function vendorPath(vendorSlug) {
  return `/vendors/${vendorSlug}`;
}

/** Where a couple registers. */
export function registrationPath() {
  return '/signup';
}

/** The public directory, used when nothing more specific applies. */
export function directoryPath() {
  return '/vendors';
}

/* -------------------------------------------------------- indexability */

/** A category page is only worth linking if it carries real inventory. */
export function isCategoryIndexable(category) {
  const count = Number(category.vendorCount ?? category.vendor_count ?? 0);
  return count >= MIN_LISTINGS_FOR_INDEX;
}

export function isLocationIndexable(location) {
  const count = Number(location.vendorCount ?? location.vendor_count ?? 0);
  return count >= MIN_LISTINGS_FOR_LOCATION_INDEX;
}

/** The count of one category inside one place, from the locations payload. */
export function combinationCount(location, categorySlug) {
  const types = location.types || [];
  const entry = types.find((t) => t.slug === categorySlug);
  return Number(entry?.count ?? 0);
}

export function isCombinationIndexable(location, categorySlug) {
  return combinationCount(location, categorySlug) >= MIN_LISTINGS_FOR_COMBINATION_INDEX;
}

/**
 * Chooses the most specific landing page that actually has inventory.
 *
 * Preference order: place+category, then place, then category, then the
 * directory. A post never links to a thin page - it would waste the click and
 * the page would not rank.
 */
export function chooseLandingPage({ location = null, category = null, audience = 'en' } = {}) {
  if (location && category && isCombinationIndexable(location, category.slug)) {
    return {
      path: combinationPath(location.slug, category.slug),
      kind: 'combination',
      count: combinationCount(location, category.slug),
      label: `${locationLabel(location.slug, location.name, audience)} - ${categoryLabelEl(category.slug, category.name)}`,
    };
  }
  if (location && isLocationIndexable(location)) {
    return {
      path: locationPath(location.slug),
      kind: 'location',
      count: Number(location.vendorCount),
      label: locationLabel(location.slug, location.name, audience),
    };
  }
  if (category && isCategoryIndexable(category)) {
    return {
      path: categoryPath(category.slug),
      kind: 'category',
      count: Number(category.vendorCount),
      label: categoryLabelEl(category.slug, category.name),
    };
  }
  return {
    path: directoryPath(),
    kind: 'directory',
    count: null,
    label: audience === 'el' ? 'Ο κατάλογος επαγγελματιών' : 'The vendor directory',
  };
}

export { locales };
