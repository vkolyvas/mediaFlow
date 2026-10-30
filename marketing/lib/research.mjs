import * as api from './ww-api.mjs';
import {
  combinationCount,
  isCombinationIndexable,
  isLocationIndexable,
  locationLabel,
  categoryLabelEl,
  categoryLabel,
  chooseLandingPage,
  CURATED_LOCATION_PAGES,
} from './seo-pages.mjs';

/**
 * Research for one content concept.
 *
 * Everything returned here is either live API data or a structural fact
 * derived from it. Nothing is invented, and nothing is ranked without a
 * stated selection rule.
 */

/** Deterministic rotation so consecutive runs do not pick the same target. */
function rotate(list, seed, count = 1) {
  if (!list.length) return [];
  const out = [];
  for (let i = 0; i < Math.min(count, list.length); i += 1) {
    out.push(list[(seed + i) % list.length]);
  }
  return out;
}

function seedFrom(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCDate() + d.getUTCMonth() * 31 + d.getUTCFullYear() % 100;
}

/**
 * Places with enough inventory to have a landing page worth linking to.
 * Curated places first (they carry the SEO slugs people search for), then
 * the rest by inventory.
 */
export async function listTargetLocations() {
  const locations = await api.getLocations();
  const curated = locations.filter((l) => CURATED_LOCATION_PAGES[l.slug]);
  const rest = locations.filter((l) => !CURATED_LOCATION_PAGES[l.slug]);
  const byInventory = (a, b) => Number(b.vendorCount) - Number(a.vendorCount);
  return {
    all: locations,
    indexable: locations.filter(isLocationIndexable).sort(byInventory),
    curated: curated.sort(byInventory),
    others: rest.sort(byInventory),
  };
}

/**
 * Greek islands and coastal towns that international couples actually plan a
 * destination wedding in. This is the audience split: the English stream
 * speaks about places a couple flies to, the Greek stream speaks about the
 * whole market - Athens and Thessaloniki first, then everywhere else.
 */
const DESTINATION_SLUGS = new Set([
  'thira',
  'mykonos',
  'kerkyra',
  'rodos',
  'paros',
  'zakynthos',
  'kefalonia',
  'naxos-kai-mikres-kyklades',
  'skiathos',
  'tinos',
  'lefkada',
  'milos',
  'sifnos',
  'kos',
  'spetses',
  'ydra',
  'patmos',
  'serifos',
  'folegandros',
  'ikaria',
  'samos',
  'astypalaia',
  'monemvasia',
  'aigina',
  'agkistri',
  'antiparos',
]);

/** Categories a destination couple looks for first. */
const DESTINATION_CATEGORIES = new Set([
  'wedding_venue',
  'wedding_hotel',
  'wedding_winery',
  'wedding_yacht',
  'wedding_photographer',
  'wedding_dj',
  'wedding_catering',
  'wedding_florist',
]);

/**
 * The places an audience segment should be shown.
 * `en` gets the destination set plus anywhere with real venue inventory.
 * `el` gets everything, largest market first.
 */
export function locationsForAudience(locations, audience) {
  const indexable = locations.filter(isLocationIndexable);
  if (audience !== 'en') return indexable;

  const destination = indexable.filter((l) => DESTINATION_SLUGS.has(l.slug));
  const withVenues = indexable.filter((l) => {
    if (DESTINATION_SLUGS.has(l.slug)) return false;
    return (l.types || []).some(
      (t) => (t.slug === 'wedding_venue' || t.slug === 'wedding_hotel') && Number(t.count || 0) >= 10,
    );
  });
  return [...destination, ...withVenues];
}

/**
 * Picks the place + category pair for a vendor-discovery concept.
 *
 * Selection rule (stated so the post can honestly say "curated", never
 * "top" or "best"): among the places that have a location landing page, we
 * take the ones that also have at least ten listings in a single category,
 * and rotate through them by date. That is a coverage rule, not a quality
 * judgement - no ranking is implied.
 */
export async function pickDiscoveryTarget(date, audience) {
  const { all } = await listTargetLocations();
  const pool = locationsForAudience(all, audience);
  const candidates = [];

  for (const location of pool) {
    for (const type of location.types || []) {
      const count = Number(type.count || 0);
      if (count < 10) continue;
      if (audience === 'en' && !DESTINATION_CATEGORIES.has(type.slug)) continue;
      candidates.push({
        location,
        category: { slug: type.slug, name: type.name, vendorCount: count },
        count,
      });
    }
  }

  candidates.sort((a, b) => b.count - a.count);
  const seed = seedFrom(date);
  const chosen = rotate(candidates, seed, 1)[0];

  if (!chosen) return null;

  const landing = chooseLandingPage({
    location: chosen.location,
    category: chosen.category,
    audience,
  });

  return {
    ...chosen,
    landing,
    locationLabel: locationLabel(chosen.location.slug, chosen.location.name, audience),
    categoryLabel:
      audience === 'el'
        ? categoryLabelEl(chosen.category.slug, chosen.category.name)
        : categoryLabel(chosen.category.slug, chosen.category.name),
    /** ASCII target used to build the UTM campaign string. */
    targetSlug: `${chosen.location.slug}-${chosen.category.slug}`,
  };
}

/** Picks a place for an inspiration concept. */
export async function pickInspirationTarget(date, audience) {
  const { all } = await listTargetLocations();
  const pool = locationsForAudience(all, audience);
  if (!pool.length) return null;
  const seed = seedFrom(date);
  const chosen = rotate(pool, seed, 1)[0];
  if (!chosen) return null;

  const landing = chooseLandingPage({ location: chosen, audience });
  return {
    location: chosen,
    landing,
    locationLabel: locationLabel(chosen.slug, chosen.name, audience),
    targetSlug: chosen.slug,
  };
}

/** Picks a category for a practical-guide concept. */
export async function pickGuideTarget(date, audience) {
  const categories = await api.getCategories();
  let pool = categories.filter((c) => Number(c.vendorCount) >= 10);
  if (audience === 'en') {
    const preferred = pool.filter((c) => DESTINATION_CATEGORIES.has(c.slug));
    if (preferred.length) pool = preferred;
  }
  pool = pool.sort((a, b) => Number(b.vendorCount) - Number(a.vendorCount));
  const seed = seedFrom(date);
  const chosen = rotate(pool, seed, 1)[0];
  if (!chosen) return null;

  const landing = chooseLandingPage({ category: chosen, audience });
  return {
    category: chosen,
    landing,
    categoryLabel:
      audience === 'el' ? categoryLabelEl(chosen.slug, chosen.name) : categoryLabel(chosen.slug, chosen.name),
    targetSlug: chosen.slug,
  };
}

/**
 * The real vendors behind a discovery concept.
 *
 * The list is the live API's answer for that place and category. Demo and
 * seed records are removed by the API client. The rotation picks five
 * different vendors each time so the same business is not featured twice in
 * a row.
 */
export async function researchVendors({ locationSlug, categorySlug, date, count = 5 }) {
  const vendors = await api.getVendorsByLocation(locationSlug, categorySlug, { limit: 20 });
  const seed = seedFrom(date);
  const picked = rotate(vendors, seed, count);

  return picked.map((vendor) => ({
    slug: vendor.slug,
    businessName: vendor.businessName,
    categorySlug: vendor.categorySlug,
    categoryName: vendor.categoryName,
    municipality: vendor.municipality,
    ratingAverage: vendor.ratingAverage,
    ratingCount: vendor.ratingCount,
    verified: vendor.verified,
    claimed: vendor.claimed,
    badges: vendor.badges,
    url: vendor.url,
  }));
}

/** Live marketplace totals, used for accurate copy such as "2,700+ vendors". */
export async function marketStats() {
  return api.getPublicStats();
}
