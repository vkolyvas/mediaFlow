#!/usr/bin/env node
/**
 * Pulls registrations and enquiries back from WeddingWise and attributes them
 * to the campaign and post that produced them.
 *
 * The marketing engine does not own the site, so conversions arrive from the
 * app's internal endpoint:
 *
 *   GET {WW_API_BASE_URL}/api/v1/internal/marketing/conversions?since=YYYY-MM-DD
 *   Authorization: Bearer {WW_INTERNAL_TOKEN}
 *
 * That endpoint is implemented in the auth-weddingwise repo (branch
 * feature/weddingwise-utm-capture). Until it exists, this script exits with a
 * clear message rather than failing obscurely.
 *
 *   node automation/collect-conversions.mjs [--days 30] [--file conversions.json]
 */
import fs from 'node:fs';
import { env } from '../lib/config.mjs';
import { all, insertConversion, closeDb } from '../lib/db.mjs';
import { parseUtm, platformFromUtmContent } from '../lib/utm.mjs';

function parseArgs(argv) {
  const args = { days: 30, file: null };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--days') args.days = Number(argv[++i]);
    else if (key === '--file') args.file = argv[++i];
  }
  return args;
}

async function fetchConversions(since) {
  if (!env.wwInternalToken) {
    throw new Error(
      'WW_INTERNAL_TOKEN is not set. The conversions endpoint is protected by a bearer token - ' +
        'see marketing/ENV.md.',
    );
  }
  const url = new URL(`${env.wwApiBaseUrl}/api/v1/internal/marketing/conversions`);
  url.searchParams.set('since', since);

  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${env.wwInternalToken}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 404) {
    throw new Error(
      'The app returned 404 for the conversions endpoint. It has not been deployed yet - ' +
        'see the UTM capture branch in auth-weddingwise.',
    );
  }
  if (!res.ok) {
    throw new Error(`conversions endpoint returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const body = await res.json();
  if (Array.isArray(body)) return body;
  return body?.data?.conversions || body?.conversions || [];
}

/** Finds the post a conversion belongs to, from utm_content = "{platform}_{fingerprint8}". */
function findPost(utm) {
  if (!utm.content) return null;
  const platform = platformFromUtmContent(utm.content);
  const fingerprint = String(utm.content).slice(platform.length + 1);
  if (!platform || !fingerprint) return null;
  const rows = all(
    `SELECT id, campaign_id FROM posts
      WHERE platform = ? AND fingerprint LIKE ?
      ORDER BY created_at DESC LIMIT 1`,
    [platform, `${fingerprint}%`],
  );
  return rows[0] || null;
}

function findCampaign(utm) {
  if (!utm.campaign) return null;
  const rows = all('SELECT id FROM campaigns WHERE utm_campaign = ? LIMIT 1', [utm.campaign]);
  return rows[0]?.id || null;
}

function main() {
  const args = parseArgs(process.argv);
  const since = new Date(Date.now() - args.days * 86400000).toISOString().slice(0, 10);

  let raw;
  if (args.file) {
    raw = JSON.parse(fs.readFileSync(args.file, 'utf8'));
    if (!Array.isArray(raw)) raw = raw.conversions || [];
  } else {
    return fetchConversions(since).then((rows) => {
      raw = rows;
      console.log(`Fetched ${raw.length} conversion(s) since ${since}.`);
    });
  }

  let inserted = 0;
  let unattributed = 0;
  const types = {};

  for (const row of raw) {
    const type = row.type === 'enquiry' ? 'enquiry' : 'registration';
    const utm = row.utm || parseUtm(row.landing_url || '');
    const post = findPost(utm);
    const campaignId = findCampaign(utm) || post?.campaign_id || null;

    if (!campaignId) unattributed += 1;

    insertConversion({
      id: row.id,
      campaignId,
      postId: post?.id || null,
      type,
      sessionId: row.session_id || null,
      landingUrl: row.landing_url || null,
      utm: {
        source: utm.source || null,
        medium: utm.medium || null,
        campaign: utm.campaign || null,
        content: utm.content || null,
        term: utm.term || null,
      },
      vendorSlug: row.vendor_slug || null,
    });

    inserted += 1;
    types[type] = (types[type] || 0) + 1;
  }

  console.log(
    `${inserted} conversion(s) stored - ${types.registration || 0} registration(s), ` +
      `${types.enquiry || 0} enquiry(s).`,
  );
  if (unattributed) {
    console.log(
      `${unattributed} could not be tied to a campaign. Either the link carried no UTM, or the ` +
        'campaign string does not match anything in this database.',
    );
  }
}

try {
  main();
} catch (err) {
  console.error(err.message);
  closeDb();
  process.exit(1);
}
closeDb();
