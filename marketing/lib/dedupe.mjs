import { createHash } from 'node:crypto';

/**
 * Creative fingerprinting.
 *
 * Two posts are "the same creative" when they share a pillar, an audience and
 * a normalised body. Normalisation strips punctuation, lowercases, collapses
 * whitespace and drops the hashtag block, so a caption that only changed its
 * hashtags does not count as new content.
 */

export function normaliseText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The fingerprint deliberately excludes the caption body and instead hashes the
 * *topic* of a post - its target landing page plus its title - because two
 * different captions about the same five photographers are the same creative
 * and should not both be published.
 */
export function fingerprint({ title, landingPath, pillar, audience }) {
  const basis = [slugish(pillar), slugish(audience), slugish(landingPath), normaliseText(title)].join('|');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

function slugish(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Near-duplicate detection over existing captions, for a softer guard. */
export function captionSimilarity(a, b) {
  const tokens = (s) => new Set(normaliseText(s).split(' ').filter((t) => t.length > 3));
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

export function isNearDuplicate(candidate, existing, threshold = 0.7) {
  return existing.some((post) => captionSimilarity(candidate, post.caption) >= threshold);
}
