/**
 * Metric normalisation.
 *
 * Postiz returns whatever the provider gave it, and every provider names
 * things differently: Meta calls it "reach" and "shares", some providers
 * nest the numbers under a time series, some put them straight on the object.
 *
 * Rather than hard-coding one shape, the normaliser walks the payload and
 * collects the numbers it recognises under their common names. It is
 * deliberately conservative - an unknown field is ignored, never guessed at.
 */

const KEY_MAP = {
  reach: ['reach', 'reached', 'reach_total', 'accounts_reached', 'unique_impressions', 'unique_reach'],
  impressions: ['impressions', 'impression_count', 'impression_total', 'views', 'plays', 'view_count'],
  likes: ['likes', 'like_count', 'reactions', 'reaction_count', 'favorites'],
  comments: ['comments', 'comment_count', 'replies', 'reply_count'],
  shares: ['shares', 'share_count', 'reposts', 'retweets', 'shares_count'],
  saves: ['saves', 'saved', 'save_count', 'bookmarks', 'bookmark_count'],
  clicks: ['clicks', 'click_count', 'link_clicks', 'link_click_count', 'outbound_clicks', 'website_clicks'],
  profileVisits: ['profile_visits', 'profile_views', 'profile_view_count', 'profile_visits_total', 'visits'],
};

const LOOKUP = new Map();
for (const [metric, keys] of Object.entries(KEY_MAP)) {
  for (const key of keys) LOOKUP.set(key.toLowerCase(), metric);
}

/** Keys that carry the aggregate of the metric they sit under. */
const AGGREGATE_KEYS = new Set(['total', 'value', 'count', 'sum']);

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Walks a payload and sums every recognised metric.
 *
 * A provider that returns both a total and a daily series would otherwise be
 * counted twice. The rule is: for each metric, the shallowest level at which
 * it appears wins, and the values at that level are summed. A total at the
 * top level therefore beats a series underneath it, while a series with no
 * total is summed on its own.
 */
export function normaliseMetrics(payload) {
  const levels = new Map();

  const record = (metric, depth, value) => {
    if (!levels.has(metric)) levels.set(metric, new Map());
    const byDepth = levels.get(metric);
    byDepth.set(depth, (byDepth.get(depth) || 0) + value);
  };

  const walk = (node, depth, context = null) => {
    if (!node || depth > 8) return;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1, context);
      return;
    }
    if (typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node)) {
      const lower = key.toLowerCase();
      let metric = LOOKUP.get(lower);
      // Inside a matched object, "total" means the metric it belongs to.
      if (!metric && context && AGGREGATE_KEYS.has(lower)) metric = context;

      if (metric) {
        const number = toNumber(value);
        if (number != null) {
          record(metric, depth, number);
          continue;
        }
        // The value is an object or an array: look inside it for the total
        // and for the same metric further down.
        walk(value, depth + 1, metric);
        continue;
      }

      walk(value, depth + 1, null);
    }
  };

  walk(payload, 0, null);

  const totals = {
    reach: 0,
    impressions: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    clicks: 0,
    profileVisits: 0,
  };
  for (const [metric, byDepth] of levels) {
    const shallowest = Math.min(...byDepth.keys());
    totals[metric] = byDepth.get(shallowest);
  }
  return totals;
}

/** The date a metric snapshot belongs to, if the payload carries one. */
export function metricDate(payload, fallback = new Date()) {
  const candidates = [];

  const walk = (node, depth) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (/^(date|day|period|timestamp)$/i.test(key) && typeof value === 'string') {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) candidates.push(parsed);
      } else {
        walk(value, depth + 1);
      }
    }
  };

  walk(payload, 0);
  if (!candidates.length) return fallback.toISOString().slice(0, 10);
  const latest = candidates.sort((a, b) => b - a)[0];
  return latest.toISOString().slice(0, 10);
}

/** A rate that never divides by zero and never returns NaN. */
export function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}
