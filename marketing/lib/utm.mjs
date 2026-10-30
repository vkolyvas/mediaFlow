import { env } from './config.mjs';

/**
 * UTM naming convention
 *
 *   utm_source   = weddingwise
 *   utm_medium   = social            (env.utmMedium)
 *   utm_campaign = ww_{audience}_{pillar}_{target}_{yyyymmdd}
 *   utm_content  = {platform}_{fingerprint8}
 *   utm_term     = optional audience/geo split
 *
 * The campaign string is the join key used when registrations and enquiries
 * come back from the WeddingWise app, so it must stay stable for the life of a
 * campaign - it is written into the campaigns table once and never rewritten.
 */

export const UTM_SOURCE = 'weddingwise';

export function slugify(value, { max = 40 } = {}) {
  const slug = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= max) return slug;
  // Cut at a word boundary so a truncated slug never ends mid-word.
  const cut = slug.slice(0, max);
  const lastDash = cut.lastIndexOf('-');
  return (lastDash > max * 0.5 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
}

export function buildUtmCampaign({ audience, pillar, target, date }) {
  const d = date instanceof Date ? date : new Date(date);
  const stamp = Number.isNaN(d.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
    : d.toISOString().slice(0, 10).replace(/-/g, '');
  const parts = ['ww', slugify(audience, { max: 16 }), slugify(pillar, { max: 16 }), slugify(target, { max: 30 })].filter(
    Boolean,
  );
  return `${parts.join('_')}_${stamp}`.slice(0, 100);
}

/**
 * Builds the landing-page URL for a post. Every published link carries UTM
 * parameters so traffic, registrations and enquiries can be attributed.
 */
export function buildTrackedUrl({ path: landingPath, campaign, platform, fingerprint, term }) {
  const url = new URL(landingPath.startsWith('http') ? landingPath : `${env.wwSiteUrl}${landingPath}`);
  url.searchParams.set('utm_source', UTM_SOURCE);
  url.searchParams.set('utm_medium', env.utmMedium);
  url.searchParams.set('utm_campaign', campaign);
  if (platform) url.searchParams.set('utm_content', `${platform}_${String(fingerprint || '').slice(0, 8)}`);
  if (term) url.searchParams.set('utm_term', term);
  return url.toString();
}

/**
 * Inverse of buildTrackedUrl - used to attribute an inbound registration or
 * enquiry back to a campaign.
 */
export function parseUtm(urlString) {
  try {
    const url = new URL(urlString, env.wwSiteUrl);
    return {
      source: url.searchParams.get('utm_source'),
      medium: url.searchParams.get('utm_medium'),
      campaign: url.searchParams.get('utm_campaign'),
      content: url.searchParams.get('utm_content'),
      term: url.searchParams.get('utm_term'),
    };
  } catch {
    return { source: null, medium: null, campaign: null, content: null, term: null };
  }
}

/** Extracts the platform from utm_content so we can attribute a conversion to one post. */
export function platformFromUtmContent(content) {
  if (!content) return null;
  const idx = content.indexOf('_');
  return idx === -1 ? content : content.slice(0, idx);
}
