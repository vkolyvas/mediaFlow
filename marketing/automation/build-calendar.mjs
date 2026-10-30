#!/usr/bin/env node
/**
 * Builds the content calendar.
 *
 * For every day in the window and every audience stream, this creates one
 * *concept* (a campaign with a landing page and a target) and two posts - one
 * for Instagram, one for Facebook - both in the IDEA state.
 *
 * Nothing is published here, and nothing is written to the marketplace. The
 * targets are resolved against live API data, so a concept always points at a
 * landing page that exists and carries inventory.
 *
 *   node automation/build-calendar.mjs [--days 30] [--start 2026-11-03]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, PILLARS, AUDIENCES, PLATFORMS, FORMATS } from '../lib/config.mjs';
import { upsertCampaign, insertPost, listPosts, closeDb } from '../lib/db.mjs';
import { buildUtmCampaign, buildTrackedUrl } from '../lib/utm.mjs';
import { fingerprint } from '../lib/dedupe.mjs';
import {
  pickDiscoveryTarget,
  pickInspirationTarget,
  pickGuideTarget,
  listTargetLocations,
  locationsForAudience,
} from '../lib/research.mjs';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseArgs(argv) {
  const args = { days: 30, start: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--days') args.days = Number(argv[++i]);
    else if (key === '--start') args.start = argv[++i];
    else if (key === '--dry-run') args.dryRun = true;
  }
  return args;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function conceptId(date, audience, pillar) {
  return `c_${date}_${audience}_${pillar}`;
}

function postId(concept, platform) {
  return `p_${concept}_${platform}`;
}

/** Resolves the target and landing page for one concept. */
async function resolveTarget(pillar, date, audience) {
  if (pillar === 'discovery') {
    const target = await pickDiscoveryTarget(date, audience);
    if (!target) return null;
    return {
      name: `${target.locationLabel} - ${target.categoryLabel}`,
      targetSlug: target.targetSlug,
      target,
      landingPath: target.landing.path,
      landingKind: target.landing.kind,
      landingLabel: target.landing.label,
      landingCount: target.landing.count,
    };
  }
  if (pillar === 'inspiration') {
    const target = await pickInspirationTarget(date, audience);
    if (!target) return null;
    return {
      name: target.locationLabel,
      targetSlug: target.targetSlug,
      target,
      landingPath: target.landing.path,
      landingKind: target.landing.kind,
      landingLabel: target.landing.label,
      landingCount: target.landing.count,
    };
  }
  if (pillar === 'guides') {
    const target = await pickGuideTarget(date, audience);
    if (!target) return null;
    return {
      name: target.categoryLabel,
      targetSlug: target.targetSlug,
      target,
      landingPath: target.landing.path,
      landingKind: target.landing.kind,
      landingLabel: target.landing.label,
      landingCount: target.landing.count,
    };
  }
  if (pillar === 'product') {
    // The product pillar links to registration, or to discovery when we have
    // no better destination. Its whole job is the conversion.
    const { all } = await listTargetLocations();
    const pool = locationsForAudience(all, audience);
    const location = pool[0] || null;
    return {
      name: 'Product demonstration',
      targetSlug: 'product',
      target: { location },
      landingPath: '/signup',
      landingKind: 'registration',
      landingLabel: audience === 'el' ? 'Δημιουργία λογαριασμού' : 'Create your account',
      landingCount: null,
    };
  }
  // engagement posts do not need a landing page; they need a conversation.
  return {
    name: 'Couple engagement',
    targetSlug: 'engagement',
    target: {},
    landingPath: null,
    landingKind: 'none',
    landingLabel: null,
    landingCount: null,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const config = JSON.parse(
    fs.readFileSync(path.join(PATHS.strategy, 'calendar-config.json'), 'utf8'),
  );

  const start = args.start ? new Date(`${args.start}T09:00:00Z`) : new Date();
  const days = Number.isFinite(args.days) ? args.days : 30;

  const calendar = [];
  let created = 0;
  let skipped = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start.getTime() + offset * 86400000);
    const dateStr = isoDate(date);
    const weekday = date.getUTCDay();
    const weekend = config.weekendStories || {};
    const slot =
      config.weekdayPlan[String(weekday)] ||
      (weekend.enabled && (weekday === 0 || weekday === 6)
        ? { pillar: 'engagement', format: weekend.format, topic: weekend.topic }
        : null);
    if (!slot) continue;

    for (const audienceId of config.audiences) {
      const audience = AUDIENCES[audienceId];
      if (!audience) continue;

      const resolved = await resolveTarget(slot.pillar, date, audienceId);
      if (!resolved) {
        skipped += 1;
        continue;
      }

      const id = conceptId(dateStr, audienceId, slot.pillar);
      const utmCampaign = buildUtmCampaign({
        audience: audience.utmAudience,
        pillar: slot.pillar,
        target: resolved.targetSlug,
        date,
      });

      const campaign = {
        id,
        name: resolved.name,
        pillar: slot.pillar,
        audience: audienceId,
        objective: PILLARS[slot.pillar].objective,
        locationSlug: resolved.target?.location?.slug || null,
        categorySlug: resolved.target?.category?.slug || null,
        landingPath: resolved.landingPath || '/',
        utmCampaign,
        plannedDate: dateStr,
      };

      if (!args.dryRun) {
        upsertCampaign(campaign);
      }

      for (const platform of PLATFORMS) {
        const fp = fingerprint({
          title: resolved.name,
          landingPath: resolved.landingPath || '/',
          pillar: slot.pillar,
          audience: audienceId,
        });
        const trackedUrl = resolved.landingPath
          ? buildTrackedUrl({
              path: resolved.landingPath,
              campaign: utmCampaign,
              platform,
              fingerprint: fp,
            })
          : null;

        const post = {
          id: postId(id, platform),
          campaignId: id,
          pillar: slot.pillar,
          audience: audienceId,
          platform,
          format: slot.format,
          state: 'IDEA',
          title: `${resolved.name} - ${slot.topic}`,
          linkUrl: trackedUrl,
          utmUrl: trackedUrl,
          landingPath: resolved.landingPath,
          utmCampaign,
          fingerprint: fp,
        };

        const existing = listPosts({ id: post.id })[0];
        if (existing) {
          skipped += 1;
          continue;
        }
        if (!args.dryRun) insertPost(post);
        created += 1;
      }

      calendar.push({
        conceptId: id,
        date: dateStr,
        weekday: WEEKDAY_NAMES[weekday],
        pillar: slot.pillar,
        pillarName: PILLARS[slot.pillar].name,
        format: slot.format,
        formatLabel: FORMATS[slot.format]?.label || slot.format,
        topic: slot.topic,
        audience: audienceId,
        audienceLabel: audience.label,
        language: audience.language,
        name: resolved.name,
        landingPath: resolved.landingPath,
        landingKind: resolved.landingKind,
        landingLabel: resolved.landingLabel,
        landingCount: resolved.landingCount,
        utmCampaign,
        posts: PLATFORMS.map((p) => ({ id: postId(id, p), platform: p })),
      });
    }
  }

  const outPath = path.join(PATHS.content, 'calendar.json');
  fs.writeFileSync(outPath, `${JSON.stringify(calendar, null, 2)}\n`);

  console.log(`Calendar written to ${outPath}`);
  console.log(`  concepts : ${calendar.length}`);
  console.log(`  posts    : ${created} created, ${skipped} skipped`);
  console.log(`  window   : ${isoDate(start)} .. ${isoDate(new Date(start.getTime() + (days - 1) * 86400000))}`);

  const byPillar = {};
  for (const entry of calendar) byPillar[entry.pillar] = (byPillar[entry.pillar] || 0) + 1;
  console.log('  pillars  :', byPillar);

  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
