import { env } from './config.mjs';
import { filterDemoRecords } from './demo-filter.mjs';

/**
 * Read-only client for the WeddingWise marketplace API.
 *
 * Rules this client enforces:
 *  - GET only. The engine never writes to the marketplace.
 *  - Only endpoints that have no analytics side-effects are used for content
 *    research, so generating a carousel does not pollute vendor impressions.
 *  - The API caps responses at 20 items; we never ask for more.
 *  - Every vendor returned is normalised into the same shape, so downstream
 *    code has exactly one vendor type to reason about.
 */

const MAX_LIMIT = 20;

class WeddingWiseApiError extends Error {
  constructor(message, { status, url } = {}) {
    super(message);
    this.name = 'WeddingWiseApiError';
    this.status = status;
    this.url = url;
  }
}

async function request(pathname, { query = {}, timeoutMs = 15000 } = {}) {
  const url = new URL(`${env.wwApiBaseUrl}/api/v1${pathname}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { accept: 'application/json' };
    if (env.wwApiToken) headers.authorization = `Bearer ${env.wwApiToken}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new WeddingWiseApiError(`WeddingWise API ${res.status} for ${pathname}`, {
        status: res.status,
        url: url.toString(),
      });
    }
    const body = await res.json();
    if (body && body.success === false) {
      throw new WeddingWiseApiError(`WeddingWise API error: ${body.message || 'unknown'}`, {
        url: url.toString(),
      });
    }
    return body?.data ?? body;
  } catch (err) {
    if (err instanceof WeddingWiseApiError) throw err;
    if (err.name === 'AbortError') {
      throw new WeddingWiseApiError(`WeddingWise API timed out for ${pathname}`, { url: url.toString() });
    }
    throw new WeddingWiseApiError(`WeddingWise API request failed for ${pathname}: ${err.message}`, {
      url: url.toString(),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Normalises the public serializer output into our stable internal shape. */
export function normaliseVendor(raw) {
  if (!raw) return null;
  const rating = raw.rating && typeof raw.rating === 'object' ? raw.rating : {};
  return {
    slug: raw.slug || raw.public_slug || raw.publicSlug || null,
    id: raw.id || raw.public_id || null,
    businessName: raw.businessName || raw.business_name || raw.name || '',
    brandName: raw.brandName || raw.brand_name || null,
    categorySlug: raw.vendor_type_slug || raw.vendorTypeSlug || null,
    categoryName: raw.vendor_type_display_name || raw.vendorTypeDisplayName || null,
    municipality: raw.municipality || raw.location || null,
    description: raw.description || '',
    logoUrl: raw.logoUrl || raw.logo_url || null,
    galleryImages: Array.isArray(raw.galleryImages) ? raw.galleryImages : Array.isArray(raw.gallery_images) ? raw.gallery_images : [],
    ratingAverage: rating.average ?? raw.ratingAverage ?? raw.rating_average ?? null,
    ratingCount: rating.count ?? raw.ratingCount ?? raw.rating_count ?? null,
    verified: Boolean(raw.verified),
    claimed: Boolean(raw.claimed ?? raw.claimed_at),
    badges: Array.isArray(raw.badges) ? raw.badges : [],
    styleTags: Array.isArray(raw.style_tags) ? raw.style_tags : Array.isArray(raw.styleTags) ? raw.styleTags : [],
    url: raw.slug ? `/vendors/${raw.slug}` : null,
  };
}

export async function getCategories() {
  const data = await request('/vendors/categories');
  const list = Array.isArray(data) ? data : data?.categories || [];
  return list.map((c) => ({
    slug: c.slug,
    name: c.name,
    nameEl: c.name_el || c.nameEl || null,
    icon: c.icon || null,
    vendorCount: c.vendor_count ?? c.vendorCount ?? null,
  }));
}

/**
 * Curated location list. Counts are always fetched live - the app's own rule
 * is that a count is never hardcoded.
 */
export async function getLocations() {
  const data = await request('/vendors/locations');
  const list = Array.isArray(data) ? data : data?.locations || [];
  return list.map((l) => ({
    slug: l.slug,
    name: l.name_en || l.nameEn || l.name,
    vendorCount: l.vendor_count ?? l.vendorCount ?? null,
    types: Array.isArray(l.types) ? l.types : [],
  }));
}

/**
 * Vendors for a category. Uses `category-listings`, which has no analytics
 * side-effects, so researching content never inflates a vendor's impressions.
 */
export async function getVendorsByCategory(categorySlug, { limit = MAX_LIMIT } = {}) {
  const data = await request('/vendors/category-listings', {
    query: { category: categorySlug },
  });
  const list = Array.isArray(data) ? data : data?.vendors || [];
  const vendors = list.slice(0, Math.min(limit, MAX_LIMIT)).map(normaliseVendor);
  return filterDemoRecords(vendors).kept;
}

/** Vendors for a location, optionally narrowed to one category. */
export async function getVendorsByLocation(locationSlug, categorySlug = null, { limit = MAX_LIMIT } = {}) {
  const data = await request('/vendors/location-listings', {
    query: { location: locationSlug, category: categorySlug || undefined },
  });
  const list = Array.isArray(data) ? data : data?.vendors || [];
  const vendors = list.slice(0, Math.min(limit, MAX_LIMIT)).map(normaliseVendor);
  return filterDemoRecords(vendors).kept;
}

/** Full public profile for one vendor. Returns null for demo/seed records. */
export async function getVendorBySlug(slug) {
  const data = await request(`/vendors/slug/${encodeURIComponent(slug)}`);
  const raw = data?.vendor || data;
  const vendor = normaliseVendor(raw);
  if (!vendor) return null;
  const { kept } = filterDemoRecords([vendor]);
  return kept[0] || null;
}

/** Public marketplace totals, used for accurate "4,000+ listings" style copy. */
export async function getPublicStats() {
  const data = await request('/public/stats');
  return {
    vendors: data?.vendors ?? null,
    planners: data?.planners ?? null,
    couples: data?.couples ?? null,
    claimedVendors: data?.claimedVendors ?? null,
    claimedPlanners: data?.claimedPlanners ?? null,
  };
}

export { WeddingWiseApiError, MAX_LIMIT };
