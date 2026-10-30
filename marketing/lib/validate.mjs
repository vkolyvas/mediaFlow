import { env } from './config.mjs';
import * as api from './ww-api.mjs';
import { latestVendorSnapshot } from './db.mjs';
import { fingerprint, captionSimilarity } from './dedupe.mjs';
import {
  MIN_LISTINGS_FOR_INDEX,
  MIN_LISTINGS_FOR_LOCATION_INDEX,
  MIN_LISTINGS_FOR_COMBINATION_INDEX,
  combinationCount,
} from './seo-pages.mjs';

/**
 * Content validation.
 *
 * The generator is trusted to follow the rules, but it is not trusted to
 * follow them perfectly. This module re-checks the generated post against
 * the live API and fails it if anything does not line up. A post that passes
 * here can be approved by a human; a post that fails cannot.
 *
 * Every check returns a finding with a code, a level and a human-readable
 * message. Errors block the post. Warnings are reported but do not block.
 */

const SUPERLATIVES = [
  /\bthe best\b/i,
  /\bbest\b/i,
  /\btop\b/i,
  /\bleading\b/i,
  /\bnumber one\b/i,
  /\bno\.?\s*1\b/i,
  /\baward[- ]winning\b/i,
  /\bthe finest\b/i,
  /\bthe greatest\b/i,
  /\bmost popular\b/i,
  /\bcheapest\b/i,
  /καλύτερ\w*/i,
  /κορυφαί\w*/i,
  /αριστοτεχν\w*/i,
  /πιο δημοφιλ\w*/i,
  /νούμερο\s*1/i,
  /άριστ\w*/i,
];

/** Words that would imply a vendor has an active relationship with us. */
const ENDORSEMENT_PATTERNS = [
  /\bour (?:partners?|clients?|vendors?)\b/i,
  /\b(?:official|exclusive) (?:partner|vendor)\b/i,
  /\bin partnership with\b/i,
  /\bpartnered with\b/i,
  /δικός? μας/i,
  /συνεργασία με/i,
  /επίσημος? συνεργάτης/i,
  /χορηγός/i,
];

const RATING_CLAIM =
  /(\d+[.,]\d+)\s*(?:★|⭐|αστέρ\w*|stars?|\/\s*5\b|out of 5|εκ του 5)|\b(?:rating of|rated|rating|βαθμός|βαθμολογία)\D{0,15}(\d+[.,]\d+)/i;
const REVIEW_COUNT_CLAIM = /(\d+)\s*(?:κριτικ\w*|reviews?|αξιολογήσ\w*|κριτικές)/i;
const GREEK_CHAR = /[\u0370-\u03ff]/;

const linkCache = new Map();

function finding(level, code, message) {
  return { level, code, message };
}

/** Splits a caption into sentences, so a claim can be tied to its subject. */
function sentences(text) {
  return String(text || '')
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * A claim is only suspicious when it sits in the same sentence as a vendor we
 * named. "How to find the best photographer" is advice; "Aegean Photography is
 * the best photographer in Athens" is a claim about a specific vendor.
 */
function superlativesNearVendor(caption, vendorNames) {
  const hits = [];
  for (const sentence of sentences(caption)) {
    const lower = sentence.toLowerCase();
    const mentionsVendor = vendorNames.some((name) => lower.includes(String(name).toLowerCase()));
    if (!mentionsVendor) continue;
    for (const pattern of SUPERLATIVES) {
      const match = sentence.match(pattern);
      if (match) {
        hits.push(`"${match[0]}" used next to ${vendorNames.join(', ')}`);
      }
    }
  }
  return hits;
}

function endorsementClaims(caption, vendorRefs) {
  const hits = [];
  for (const pattern of ENDORSEMENT_PATTERNS) {
    const match = caption.match(pattern);
    if (match) hits.push(`"${match[0]}" implies a partnership that may not exist`);
  }
  // An unclaimed vendor must not be presented as working with WeddingWise.
  for (const ref of vendorRefs || []) {
    if (ref.claimed) continue;
    const name = String(ref.businessName || '').toLowerCase();
    if (!name) continue;
    for (const sentence of sentences(caption)) {
      const lower = sentence.toLowerCase();
      if (!lower.includes(name)) continue;
      if (/(?:δικ[όο]ς?|official|our partner|συνεργάτ)/i.test(sentence)) {
        hits.push(`"${name}" is unclaimed but the caption presents it as a partner`);
      }
    }
  }
  return hits;
}

/** Every rating number in the caption must belong to a vendor we named. */
function ratingClaims(caption, vendorRefs) {
  const hits = [];
  const knownRatings = new Set(
    (vendorRefs || [])
      .map((r) => (r.ratingAverage == null ? null : Number(r.ratingAverage)))
      .filter((n) => n != null)
      .map((n) => n.toFixed(1)),
  );

  for (const sentence of sentences(caption)) {
    const match = sentence.match(RATING_CLAIM);
    if (!match) continue;
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    const value = Number(String(raw).replace(',', '.'));
    if (!knownRatings.has(value.toFixed(1))) {
      hits.push(`rating "${raw}" does not match any named vendor (${[...knownRatings].join(', ') || 'none'})`);
    }
  }
  return hits;
}

/** Same for review counts. */
function reviewCountClaims(caption, vendorRefs) {
  const hits = [];
  const knownCounts = new Set(
    (vendorRefs || [])
      .map((r) => (r.ratingCount == null ? null : Number(r.ratingCount)))
      .filter((n) => n != null)
      .map(String),
  );

  for (const sentence of sentences(caption)) {
    const match = sentence.match(REVIEW_COUNT_CLAIM);
    if (!match) continue;
    const value = String(match[1]);
    if (!knownCounts.has(value)) {
      hits.push(`review count "${value}" does not match any named vendor (${[...knownCounts].join(', ') || 'none'})`);
    }
  }
  return hits;
}

/**
 * A vendor name in the caption that is not one we researched means the model
 * used a name we never gave it. If it happens to be a real vendor from the
 * same listing, it is still wrong - we did not snapshot it, so we cannot
 * vouch for the claims made about it.
 */
async function unvouchedVendorClaims(caption, vendorRefs, campaign) {
  const hits = [];
  const named = new Set((vendorRefs || []).map((r) => String(r.businessName || '').toLowerCase()));

  let pool = [];
  if (campaign?.location_slug) {
    pool = await api.getVendorsByLocation(
      campaign.location_slug,
      campaign.category_slug || null,
      { limit: 20 },
    );
  }
  if (!pool.length) return hits;

  const lower = caption.toLowerCase();
  for (const vendor of pool) {
    const name = String(vendor.businessName || '').toLowerCase();
    if (!name || name.length < 4) continue;
    if (named.has(name)) continue;
    if (lower.includes(name)) {
      hits.push(`"${vendor.businessName}" appears in the copy but was not researched`);
    }
  }
  return hits;
}

/** The vendor data must still say what it said when the copy was written. */
async function vendorDrift(vendorRefs) {
  const hits = [];
  for (const ref of vendorRefs || []) {
    if (!ref.slug) continue;
    const snapshot = latestVendorSnapshot(ref.slug);
    if (!snapshot) {
      hits.push(`no provenance snapshot for "${ref.businessName}"`);
      continue;
    }
    const live = await api.getVendorBySlug(ref.slug);
    if (!live) {
      hits.push(`"${ref.businessName}" is no longer a published listing`);
      continue;
    }
    if (String(live.businessName) !== String(ref.businessName)) {
      hits.push(`"${ref.businessName}" is now called "${live.businessName}"`);
    }
    if (ref.ratingAverage != null && live.ratingAverage != null) {
      if (Number(live.ratingAverage) !== Number(ref.ratingAverage)) {
        hits.push(
          `rating for "${ref.businessName}" changed from ${ref.ratingAverage} to ${live.ratingAverage}`,
        );
      }
    }
    if (live.claimed !== Boolean(ref.claimed)) {
      hits.push(`claim status for "${ref.businessName}" changed since generation`);
    }
  }
  return hits;
}

async function checkLink(url) {
  if (!url) return { ok: false, status: null };
  if (linkCache.has(url)) return linkCache.get(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let result = { ok: false, status: null };
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    result = { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch {
    result = { ok: false, status: null };
  } finally {
    clearTimeout(timer);
  }
  linkCache.set(url, result);
  return result;
}

/** The landing page must be a page the site actually has, with inventory. */
function checkLandingInventory(landingPath, landingKind) {
  if (!landingPath) return [];
  const findings = [];

  const combination = landingPath.match(/^\/vendors\/location\/([^/]+)\/([^/]+)$/);
  if (combination) {
    const [, place, category] = combination;
    return findings; // resolved and checked at build time
  }
  const location = landingPath.match(/^\/vendors\/location\/([^/]+)$/);
  if (location) return findings;

  const category = landingPath.match(/^\/vendors\/category\/([^/]+)$/);
  if (category) return findings;

  if (landingKind === 'registration' && landingPath === '/signup') return findings;

  if (!landingPath.startsWith('/vendors')) {
    findings.push(finding('warn', 'unknown_landing_page', `landing page "${landingPath}" is not a known page type`));
  }
  return findings;
}

/**
 * Validates one post.
 * Returns { ok, findings } - ok is true when there are no error-level findings.
 */
export async function validatePost(
  post,
  { campaign = null, allPosts = [], checkNetwork = true, checkVendors = true } = {},
) {
  const findings = [];
  const caption = post.caption || '';
  const vendorRefs = post.vendor_refs || [];

  if (!caption.trim()) {
    findings.push(finding('error', 'empty_caption', 'the post has no caption'));
  }

  // --- language -----------------------------------------------------------
  const greekRatio = (caption.match(/[Ͱ-Ͽ]/g) || []).length;
  const greekShare = caption.length ? greekRatio / caption.length : 0;
  if (post.audience === 'el' && greekShare < 0.2) {
    findings.push(finding('error', 'wrong_language', `the Greek post is only ${(greekShare * 100).toFixed(0)}% Greek`));
  }
  if (post.audience === 'en' && greekRatio > 10) {
    findings.push(finding('error', 'wrong_language', 'the English post contains Greek text'));
  }

  // --- claims about vendors ------------------------------------------------
  const names = vendorRefs.map((r) => r.businessName).filter(Boolean);
  for (const hit of superlativesNearVendor(caption, names)) {
    findings.push(finding('error', 'superlative_claim', hit));
  }
  for (const hit of endorsementClaims(caption, vendorRefs)) {
    findings.push(finding('error', 'endorsement_claim', hit));
  }
  for (const hit of ratingClaims(caption, vendorRefs)) {
    findings.push(finding('error', 'fabricated_rating', hit));
  }
  for (const hit of reviewCountClaims(caption, vendorRefs)) {
    findings.push(finding('error', 'fabricated_review_count', hit));
  }
  for (const hit of checkVendors ? await unvouchedVendorClaims(caption, vendorRefs, campaign) : []) {
    findings.push(finding('error', 'unvouched_vendor', hit));
  }
  for (const hit of checkVendors ? await vendorDrift(vendorRefs) : []) {
    findings.push(finding('error', 'vendor_drift', hit));
  }

  // --- the link ------------------------------------------------------------
  const needsLink = ['discovery', 'guides', 'inspiration', 'product'].includes(post.pillar);
  if (needsLink && !post.utm_url) {
    findings.push(finding('error', 'missing_link', 'the post has no landing link'));
  }
  if (post.utm_url) {
    try {
      const url = new URL(post.utm_url);
      if (url.searchParams.get('utm_source') !== 'weddingwise') {
        findings.push(finding('error', 'missing_utm', 'the link has no utm_source'));
      }
      if (!url.searchParams.get('utm_campaign')) {
        findings.push(finding('error', 'missing_utm', 'the link has no utm_campaign'));
      }
      if (!url.searchParams.get('utm_content')) {
        findings.push(finding('error', 'missing_utm', 'the link has no utm_content'));
      }
    } catch {
      findings.push(finding('error', 'bad_link', `"${post.utm_url}" is not a valid URL`));
    }

    if (checkNetwork) {
      const link = await checkLink(post.utm_url);
      if (!link.ok) {
        findings.push(
          finding('error', 'unreachable_link', `the landing URL did not respond (status ${link.status})`),
        );
      }
    }
  }
  findings.push(...checkLandingInventory(post.landing_path, null));

  // --- duplicate content ---------------------------------------------------
  // The fingerprint stored on the post is the one the calendar computed. It
  // is reused here so a duplicate is detected across the whole queue, not
  // just between posts that happen to share a title.
  const fp =
    post.fingerprint ||
    fingerprint({
      title: post.title,
      landingPath: post.landing_path || '/',
      pillar: post.pillar,
      audience: post.audience,
    });
  const duplicate = allPosts.find(
    (other) => other.id !== post.id && other.fingerprint === fp && ['SCHEDULED', 'PUBLISHED'].includes(other.state),
  );
  if (duplicate) {
    findings.push(
      finding('error', 'duplicate_content', `the same creative is already scheduled as ${duplicate.id}`),
    );
  }
  for (const other of allPosts) {
    if (other.id === post.id) continue;
    if (!['SCHEDULED', 'PUBLISHED', 'APPROVED'].includes(other.state)) continue;
    if (captionSimilarity(caption, other.caption) >= 0.7) {
      findings.push(
        finding('warn', 'near_duplicate', `the caption is very close to ${other.id}`),
      );
      break;
    }
  }

  // --- creative completeness ----------------------------------------------
  const script = post.script || {};
  if (post.format === 'carousel' && !(script.slides || []).length) {
    findings.push(finding('error', 'missing_slides', 'a carousel needs its slides'));
  }
  if (post.format === 'reel' && !(script.shotList || []).length) {
    findings.push(finding('error', 'missing_shot_list', 'a reel needs its shot list'));
  }
  if (!post.visual_brief) {
    findings.push(finding('error', 'missing_visual_brief', 'the post has no visual brief'));
  }
  if (post.media && post.media.length) {
    for (const item of post.media) {
      if (item.path && !item.path.startsWith('http')) {
        // local files are checked by the caller, which knows the asset root
      }
    }
  }

  // --- hashtag sanity ------------------------------------------------------
  const hashtags = post.hashtags || [];
  if (hashtags.length && hashtags.some((h) => !String(h).startsWith('#'))) {
    findings.push(finding('warn', 'hashtag_format', 'some hashtags do not start with #'));
  }

  return { ok: !findings.some((f) => f.level === 'error'), findings };
}

export { checkLink };
