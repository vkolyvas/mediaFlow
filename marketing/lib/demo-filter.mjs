/**
 * Demo and seed record exclusion.
 *
 * The WeddingWise production database still contains the rows created by the
 * demo seeding scripts (database/seeds/demo-*.sql). Those rows carry
 * fabricated ratings, gallery images pointing at stock photos, and contact
 * details on @weddingwise.test. They exist so the video pipeline can render a
 * believable product demo - they are not real businesses.
 *
 * Publishing them to a real Instagram or Facebook audience would be false
 * marketing, so the content engine refuses to use them. Every read path in
 * ww-api.mjs runs through this filter.
 *
 * Detection is by three independent signals, any of which is disqualifying:
 *  1. the public slug is a known demo slug;
 *  2. the record id is one of the fixed demo UUIDs (they use a repeated hex
 *     pattern rather than a random v4);
 *  3. the business name is a known demo business.
 *
 * Set WW_DEMO_STRICT=1 to turn a missed demo record into a hard error rather
 * than a silent skip - useful when the seed set changes.
 */

const DEMO_SLUGS = new Set([
  'aegean-photography',
  'aegean-wedding-planners',
  'demo-aegean-catering',
  'demo-athens-djs',
  'demo-cliffside-venue',
  'demo-elena-k-photography',
  'demo-santorini-blooms',
  'demo-wedding-stories-planner',
]);

const DEMO_BUSINESS_NAMES = new Set([
  'Aegean Photography',
  'Aegean Photo',
  'Elena K. Photography',
  'Aegean Catering',
  'Athens DJs',
  'Cliffside Venue',
  'Santorini Blooms',
  'Wedding Stories',
]);

/** Demo seed UUIDs are hand-written, so the first groups repeat a pattern. */
const REPEATED_UUID = /^(?:(.)\1{7}|(..)\2{3})-/;

function extraSlugs() {
  const raw = process.env.WW_DEMO_SLUG_BLOCKLIST || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isDemoRecord(vendor) {
  if (!vendor) return false;

  const slug = String(vendor.slug || '').toLowerCase();
  const id = String(vendor.id || '').toLowerCase();
  const name = String(vendor.businessName || '').trim().toLowerCase();

  if (slug.startsWith('demo-')) return true;
  if (DEMO_SLUGS.has(slug)) return true;
  if (extraSlugs().has(slug)) return true;

  if (id && REPEATED_UUID.test(id)) return true;

  for (const demoName of DEMO_BUSINESS_NAMES) {
    if (name === demoName.toLowerCase()) return true;
  }

  return false;
}

/**
 * Removes demo records from a list of normalised vendors.
 * Returns the surviving vendors plus the ones that were dropped, so the
 * caller can log exactly what was excluded and why.
 */
export function filterDemoRecords(vendors) {
  const kept = [];
  const dropped = [];
  for (const vendor of vendors || []) {
    if (isDemoRecord(vendor)) dropped.push(vendor);
    else kept.push(vendor);
  }
  if (dropped.length && process.env.WW_DEMO_STRICT === '1') {
    throw new Error(
      `Demo records reached the content engine: ${dropped.map((v) => v.slug).join(', ')}. ` +
        `This is a data-hygiene problem in the WeddingWise database.`,
    );
  }
  return { kept, dropped };
}
