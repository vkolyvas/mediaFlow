import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');

export const PATHS = {
  root: ROOT,
  data: path.join(ROOT, '.data'),
  db: process.env.MARKETING_DB_PATH
    ? path.resolve(ROOT, process.env.MARKETING_DB_PATH)
    : path.join(ROOT, '.data', 'marketing.db'),
  brand: path.join(ROOT, 'brand'),
  strategy: path.join(ROOT, 'strategy'),
  content: path.join(ROOT, 'content'),
  campaigns: path.join(ROOT, 'campaigns'),
  assets: path.join(ROOT, 'assets'),
  analytics: path.join(ROOT, 'analytics'),
  automation: path.join(ROOT, 'automation'),
  infra: path.join(ROOT, 'infra'),
};

/**
 * Env with defaults. Scripts are launched with `node --env-file-if-exists=.env`
 * so process.env already carries the values; this only supplies defaults and
 * validates the ones we cannot work without.
 */
export const env = {
  wwApiBaseUrl: (process.env.WW_API_BASE_URL || 'https://api.weddingwise.gr').replace(/\/+$/, ''),
  wwApiToken: process.env.WW_API_TOKEN || '',
  /** Read-only token for the app's internal marketing endpoint (see auth-weddingwise). */
  wwInternalToken: process.env.WW_INTERNAL_TOKEN || '',
  wwSiteUrl: (process.env.WW_SITE_URL || 'https://weddingwise.gr').replace(/\/+$/, ''),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  /**
   * The API base to talk to. Anthropic's own by default; a gateway that
   * speaks the same Messages API (MiniMax's Anthropic-compatible endpoint,
   * for one) is the same contract with a different host. Only the base
   * changes - the request shape is identical.
   */
  anthropicBaseUrl: (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, ''),
  defaultModel: process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514',
  maxTokens: Number(process.env.MAX_TOKENS_PER_CALL || 4000),
  postizApiUrl: (process.env.POSTIZ_API_URL || 'http://localhost:4007/api').replace(/\/+$/, ''),
  postizApiKey: process.env.POSTIZ_API_KEY || '',
  postizInstagramId: process.env.POSTIZ_INSTAGRAM_ID || '',
  postizFacebookId: process.env.POSTIZ_FACEBOOK_ID || '',
  assetsDir: path.resolve(ROOT, process.env.MARKETING_ASSETS_DIR || './assets/generated'),
  utmMedium: process.env.UTM_MEDIUM || 'social',
  publicUrl: (process.env.MARKETING_PUBLIC_URL || process.env.WW_SITE_URL || 'https://weddingwise.gr').replace(/\/+$/, ''),
};

/**
 * Fails loudly when a required credential is missing, so a run never silently
 * produces empty content.
 */
export function requireEnv(...keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Set them in marketing/.env (see marketing/.env.example).`,
    );
  }
  return env;
}

export function ensureDirs() {
  const dirs = [
    PATHS.data,
    path.dirname(PATHS.db),
    PATHS.assets,
    PATHS.content,
    PATHS.campaigns,
    PATHS.analytics,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * WeddingWise brand tokens. Sourced from the app's own design system so the
 * social templates stay identical to the site.
 */
export const BRAND = {
  name: 'WeddingWise',
  domain: 'weddingwise.gr',
  /** favicon.svg gradient */
  rose: '#E11D48',
  roseLight: '#FB7185',
  /** tailwind.config.js brand ramp */
  brand600: '#C93A5F',
  brand700: '#A32F4D',
  brand50: '#FDF2F4',
  brand100: '#FCE4E8',
  gold: '#C9A962',
  goldLight: '#F7E7CE',
  champagne: '#F7E7CE',
  slate900: '#0F172A',
  slate600: '#475569',
  slate50: '#F8FAFC',
  sans: 'Bricolage Grotesque',
  serif: 'Cormorant Garamond',
  logo: {
    /** No standalone logo file exists in the app; this reproduces favicon.svg. */
    mark: 'rounded-square gradient with a white heart',
    favicon: 'frontend/public/favicon.svg',
  },
};

/** The five acquisition content pillars. */
export const PILLARS = {
  inspiration: {
    id: 'inspiration',
    name: 'Wedding inspiration',
    nameEl: 'Γάμος - έμπνευση',
    objective: 'awareness',
    description:
      'Dream weddings, island settings, decoration and realistic budget inspiration. Pure discovery and reach.',
  },
  guides: {
    id: 'guides',
    name: 'Practical planning guides',
    nameEl: 'Οδηγοί οργάνωσης',
    objective: 'consideration',
    description:
      'How to choose a photographer, when to book a venue, planning checklists. Saves and shares.',
  },
  discovery: {
    id: 'discovery',
    name: 'Vendor discovery',
    nameEl: 'Ανακάλυψη επαγγελματιών',
    objective: 'consideration',
    description:
      'Curated vendor spotlights by location and category. Drives traffic into WeddingWise search pages.',
  },
  engagement: {
    id: 'engagement',
    name: 'Couple engagement',
    nameEl: 'Engagement ζευγαριών',
    objective: 'awareness',
    description:
      'Polls, "this or that", questions about wedding style. Community growth and algorithm reach.',
  },
  product: {
    id: 'product',
    name: 'Product demonstration',
    nameEl: 'Παρουσίαση του WeddingWise',
    objective: 'registration',
    description:
      'Show how to find vendors by location, compare categories, start planning. The conversion pillar.',
  },
};

/** Two acquisition segments, each with its own language and content strategy. */
export const AUDIENCES = {
  el: {
    id: 'el',
    label: 'Greek couples',
    language: 'el',
    labelNative: 'Ζευγάρια στην Ελλάδα',
    utmAudience: 'greek',
  },
  en: {
    id: 'en',
    label: 'International destination couples',
    language: 'en',
    labelNative: 'International couples',
    utmAudience: 'destination',
  },
};

export const PLATFORMS = ['instagram', 'facebook'];

export const FORMATS = {
  reel: { id: 'reel', aspect: '9:16', label: 'Reel / short video' },
  carousel: { id: 'carousel', aspect: '4:5', label: 'Carousel' },
  story: { id: 'story', aspect: '9:16', label: 'Story sequence' },
  feed_post: { id: 'feed_post', aspect: '4:5', label: 'Feed post' },
};
