#!/usr/bin/env node
/**
 * The weekly performance report.
 *
 * Follows the acquisition funnel rather than the vanity metrics:
 *
 *   reach -> engagement -> profile visits -> website clicks -> registrations -> enquiries
 *
 * It answers the five questions the report is supposed to answer, and it
 * recommends next week's content from what actually performed - not from
 * what we hoped would.
 *
 *   node automation/report.mjs [--days 7] [--output analytics/weekly-reports]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, PILLARS } from '../lib/config.mjs';
import { all, listPosts, getCampaign, closeDb } from '../lib/db.mjs';
import { rate } from '../lib/metrics.mjs';

function parseArgs(argv) {
  const args = { days: 7, output: path.join(PATHS.analytics, 'weekly-reports') };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--days') args.days = Number(argv[++i]);
    else if (key === '--output') args.output = argv[++i];
  }
  return args;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function groupBy(rows, keyFn) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function table(headers, rows) {
  if (!rows.length) return '_No data yet._\n';
  const line = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${line}\n${divider}\n${body}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  const since = new Date(Date.now() - args.days * 86400000).toISOString().slice(0, 10);

  const metrics = all(
    `SELECT m.*, p.pillar, p.audience, p.platform, p.campaign_id, p.title, p.landing_path, p.id AS post_id
       FROM metrics m JOIN posts p ON p.id = m.post_id
      WHERE m.date >= ?`,
    [since],
  );

  const conversions = all(
    `SELECT c.*, ca.pillar, ca.audience, ca.location_slug, ca.category_slug, ca.name AS campaign_name
       FROM conversions c LEFT JOIN campaigns ca ON ca.id = c.campaign_id
      WHERE c.created_at >= ?`,
    [`${since} 00:00:00`],
  );

  const posts = listPosts({});
  const campaigns = new Map();
  for (const post of posts) {
    if (post.campaignId && !campaigns.has(post.campaignId)) {
      campaigns.set(post.campaignId, getCampaign(post.campaignId));
    }
  }

  const totals = {
    reach: sum(metrics, 'reach'),
    impressions: sum(metrics, 'impressions'),
    likes: sum(metrics, 'likes'),
    comments: sum(metrics, 'comments'),
    shares: sum(metrics, 'shares'),
    saves: sum(metrics, 'saves'),
    clicks: sum(metrics, 'clicks'),
    profileVisits: sum(metrics, 'profile_visits'),
  };
  const registrations = conversions.filter((c) => c.type === 'registration').length;
  const enquiries = conversions.filter((c) => c.type === 'enquiry').length;

  const lines = [];
  lines.push(`# WeddingWise social report - ${since} to ${new Date().toISOString().slice(0, 10)}`);
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}.`);
  lines.push('');

  lines.push('## The funnel');
  lines.push('');
  lines.push(
    table(
      ['Stage', 'Count', 'Step conversion'],
      [
        ['Reach', String(totals.reach), '-'],
        ['Impressions', String(totals.impressions), `${rate(totals.impressions, totals.reach)}% of reach`],
        ['Engagements (likes + comments + shares + saves)', String(totals.likes + totals.comments + totals.shares + totals.saves), `${rate(totals.likes + totals.comments + totals.shares + totals.saves, totals.impressions)}% of impressions`],
        ['Profile visits', String(totals.profileVisits), `${rate(totals.profileVisits, totals.impressions)}% of impressions`],
        ['Website clicks', String(totals.clicks), `${rate(totals.clicks, totals.profileVisits)}% of profile visits`],
        ['Couple registrations', String(registrations), `${rate(registrations, totals.clicks)}% of clicks`],
        ['Vendor enquiries', String(enquiries), `${rate(enquiries, registrations || totals.clicks)}% of registrations`],
      ],
    ),
  );

  lines.push('## 1. Which posts generated the most website visits?');
  lines.push('');
  const byPost = groupBy(metrics, (m) => m.post_id);
  const topPosts = [...byPost.entries()]
    .map(([postId, rows]) => ({
      postId,
      pillar: rows[0].pillar,
      audience: rows[0].audience,
      platform: rows[0].platform,
      clicks: sum(rows, 'clicks'),
      reach: sum(rows, 'reach'),
      engagements: sum(rows, 'likes') + sum(rows, 'comments') + sum(rows, 'shares') + sum(rows, 'saves'),
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  lines.push(
    table(
      ['Post', 'Pillar', 'Audience', 'Platform', 'Clicks', 'Reach', 'Engagements'],
      topPosts.map((p) => [p.postId, p.pillar, p.audience, p.platform, p.clicks, p.reach, p.engagements]),
    ),
  );

  lines.push('## 2. Which locations attract the most interest?');
  lines.push('');
  const byLocation = groupBy(
    metrics.filter((m) => campaigns.get(m.campaign_id)?.location_slug),
    (m) => campaigns.get(m.campaign_id).location_slug,
  );
  lines.push(
    table(
      ['Location', 'Posts', 'Reach', 'Clicks'],
      [...byLocation.entries()]
        .map(([slug, rows]) => [slug, rows.length, sum(rows, 'reach'), sum(rows, 'clicks')])
        .sort((a, b) => Number(b[3]) - Number(a[3])),
    ),
  );

  lines.push('## 3. Which categories generate the most couple registrations?');
  lines.push('');
  const byCategory = groupBy(
    conversions.filter((c) => c.category_slug),
    (c) => c.category_slug,
  );
  lines.push(
    table(
      ['Category', 'Registrations', 'Enquiries'],
      [...byCategory.entries()].map(([slug, rows]) => [
        slug,
        rows.filter((r) => r.type === 'registration').length,
        rows.filter((r) => r.type === 'enquiry').length,
      ]),
    ),
  );

  lines.push('## 4. What generates registrations rather than just likes?');
  lines.push('');
  const byPillar = groupBy(metrics, (m) => m.pillar);
  const registrationsByPillar = new Map();
  for (const conversion of conversions) {
    const pillar = conversion.pillar;
    if (!pillar) continue;
    registrationsByPillar.set(pillar, (registrationsByPillar.get(pillar) || 0) + 1);
  }
  lines.push(
    table(
      ['Pillar', 'Posts', 'Reach', 'Engagements', 'Conversions', 'Conversion rate'],
      [...byPillar.entries()].map(([pillar, rows]) => {
        const engagements = sum(rows, 'likes') + sum(rows, 'comments') + sum(rows, 'shares') + sum(rows, 'saves');
        const conversionsForPillar = registrationsByPillar.get(pillar) || 0;
        return [
          `${pillar} - ${PILLARS[pillar]?.name || ''}`,
          rows.length,
          sum(rows, 'reach'),
          engagements,
          conversionsForPillar,
          `${rate(conversionsForPillar, engagements)}%`,
        ];
      }),
    ),
  );

  lines.push('## 5. What should we publish more of next week?');
  lines.push('');
  lines.push(...buildRecommendation(metrics, conversions, byPillar, registrationsByPillar));
  lines.push('');

  const dir = path.resolve(args.output);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(file, `${lines.join('\n')}\n`);

  console.log(lines.join('\n'));
  console.log(`\nReport written to ${file}`);
  closeDb();
}

/**
 * The recommendation is derived from the data: the pillars that turned
 * engagement into registrations are the ones to make more of, and the ones
 * that did not get less of the same treatment.
 */
function buildRecommendation(metrics, conversions, byPillar, registrationsByPillar) {
  const out = [];

  if (!metrics.length) {
    out.push('No performance data has been collected yet, so there is nothing to recommend from.');
    out.push('Run `npm run schedule`, let the posts go out, then `npm run collect` and this report again.');
    return out;
  }

  const scored = [...byPillar.entries()]
    .map(([pillar, rows]) => {
      const engagements = sum(rows, 'likes') + sum(rows, 'comments') + sum(rows, 'shares') + sum(rows, 'saves');
      const conversionsForPillar = registrationsByPillar.get(pillar) || 0;
      return { pillar, engagements, conversions: conversionsForPillar, reach: sum(rows, 'reach') };
    })
    .sort((a, b) => {
      const rateA = a.engagements ? a.conversions / a.engagements : 0;
      const rateB = b.engagements ? b.conversions / b.engagements : 0;
      return rateB - rateA;
    });

  if (scored[0] && scored[0].conversions > 0) {
    out.push(
      `**Publish more ${scored[0].pillar}.** It produced ${scored[0].conversions} conversion(s) from ${scored[0].engagements} engagement(s) - the best conversion rate of the pillars that ran.`,
    );
  } else {
    out.push(
      '**No pillar has produced a tracked conversion yet.** Keep the mix as it is for another week, but check that the UTM capture is working - without it, registrations cannot be attributed to a post and this recommendation stays blind.',
    );
  }

  const zero = scored.filter((s) => s.engagements > 0 && s.conversions === 0);
  if (zero.length) {
    out.push(
      `**Change the approach on ${zero.map((z) => z.pillar).join(', ')}.** These reached people but produced no tracked registration - the call to action or the landing page is the thing to test, not the topic.`,
    );
  }

  const bestReach = [...scored].sort((a, b) => b.reach - a.reach)[0];
  if (bestReach) {
    out.push(
      `**${bestReach.pillar} has the reach** (${bestReach.reach} impressions). Keep it in the calendar even if it converts less - it is what brings the audience in for the pillars that do convert.`,
    );
  }

  const audienceReach = groupBy(metrics, (m) => m.audience);
  const audienceRows = [...audienceReach.entries()].map(([audience, rows]) => ({
    audience,
    reach: sum(rows, 'reach'),
    clicks: sum(rows, 'clicks'),
  }));
  if (audienceRows.length === 2) {
    const [a, b] = audienceRows.sort((x, y) => y.reach - x.reach);
    out.push(
      `**The ${a.audience} stream is currently ahead** on reach (${a.reach} against ${b.reach}) and clicks (${a.clicks} against ${b.clicks}). The split between the two audiences is worth watching weekly before the ratio is changed.`,
    );
  }

  return out;
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
