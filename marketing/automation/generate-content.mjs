#!/usr/bin/env node
/**
 * Generates post content from live WeddingWise data.
 *
 * One model call produces both platform variants for a concept, so the
 * Instagram and Facebook versions of the same idea stay consistent while
 * still being written for their platform.
 *
 * The generated copy is saved in the GENERATED state. It has not been checked
 * against the API yet - that is validate-content.mjs's job, and nothing can be
 * scheduled until it has run.
 *
 *   node automation/generate-content.mjs [--limit 5] [--pillar discovery]
 *                                         [--audience el] [--date 2026-11-03]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PATHS, AUDIENCES, PLATFORMS } from '../lib/config.mjs';
import {
  listPosts,
  getCampaign,
  updatePost,
  recordEvent,
  saveVendorSnapshot,
  closeDb,
} from '../lib/db.mjs';
import { assertTransition, STATES } from '../lib/state.mjs';
import { generateJson } from '../lib/llm.mjs';
import { SYSTEM_PROMPT, buildUserPrompt, buildDataBlock } from '../lib/prompts.mjs';
import { researchVendors, marketStats, listTargetLocations } from '../lib/research.mjs';
import * as api from '../lib/ww-api.mjs';

function parseArgs(argv) {
  const args = { limit: 5, pillar: null, audience: null, date: null, force: false };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--limit') args.limit = Number(argv[++i]);
    else if (key === '--pillar') args.pillar = argv[++i];
    else if (key === '--audience') args.audience = argv[++i];
    else if (key === '--date') args.date = argv[++i];
    else if (key === '--force') args.force = true;
  }
  return args;
}

/** Groups the IDEA posts by concept so both platforms are written together. */
function groupByConcept(posts) {
  const groups = new Map();
  for (const post of posts) {
    const key = post.campaignId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(post);
  }
  return groups;
}

async function gatherResearch(concept, campaign) {
  const date = campaign.planned_date || new Date().toISOString().slice(0, 10);
  const research = { vendors: [], location: null, category: null };

  if (concept.pillar === 'discovery') {
    const vendors = await researchVendors({
      locationSlug: campaign.location_slug,
      categorySlug: campaign.category_slug,
      date,
      count: 5,
    });
    research.vendors = vendors.map((v) => ({
      business_name: v.businessName,
      public_slug: v.slug,
      category: v.categoryName,
      municipality: v.municipality,
      rating: v.ratingAverage,
      rating_count: v.ratingCount,
      verified: v.verified,
      claimed_by_the_business: v.claimed,
      badges: v.badges,
      profile_path: v.url,
      note: v.claimed
        ? 'The business has claimed this listing.'
        : 'Nobody has claimed this listing yet - do not imply the business works with WeddingWise.',
    }));
  }

  if (concept.pillar === 'inspiration' || concept.pillar === 'product') {
    const { all } = await listTargetLocations();
    const location = all.find((l) => l.slug === campaign.location_slug);
    if (location) {
      research.location = {
        name: location.name,
        listings: Number(location.vendorCount),
      };
    }
  }

  if (concept.pillar === 'guides') {
    const categories = await api.getCategories();
    const category = categories.find((c) => c.slug === campaign.category_slug);
    if (category) {
      research.category = {
        name: category.name,
        listings: Number(category.vendorCount),
      };
    }
  }

  return research;
}

function writeDraftFile(post, payload, state) {
  const dir = path.join(PATHS.content, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${post.id}.json`);
  fs.writeFileSync(
    file,
    `${JSON.stringify(
      {
        id: post.id,
        campaign: post.campaignId,
        pillar: post.pillar,
        audience: post.audience,
        platform: post.platform,
        format: post.format,
        state,
        link: post.utmUrl,
        ...payload,
      },
      null,
      2,
    )}\n`,
  );
  return file;
}

async function main() {
  const args = parseArgs(process.argv);

  const filter = { state: STATES.IDEA };
  if (args.pillar) filter.pillar = args.pillar;
  if (args.audience) filter.audience = args.audience;

  let posts = listPosts(filter);
  if (args.date) {
    posts = posts.filter((p) => {
      const campaign = getCampaign(p.campaignId);
      return campaign?.planned_date === args.date;
    });
  }

  const groups = [...groupByConcept(posts).entries()].slice(0, args.limit);
  if (!groups.length) {
    console.log('No IDEA posts to generate. Run `npm run calendar` first.');
    closeDb();
    return;
  }

  const market = await marketStats();
  const marketBlock = market?.vendors
    ? {
        vendors_listed: Number(market.vendors),
        planners_listed: Number(market.planners || 0),
        couples_registered: Number(market.couples || 0),
      }
    : null;

  let generated = 0;
  let failed = 0;

  for (const [campaignId, group] of groups) {
    const campaign = getCampaign(campaignId);
    const concept = {
      pillar: campaign.pillar,
      topic: campaign.name,
      format: group[0].format,
      audience: campaign.audience,
      landingPath: campaign.landing_path,
      landingKind: null,
      landingLabel: campaign.name,
      linkUrl: group[0].utmUrl,
    };

    const audience = AUDIENCES[campaign.audience];
    console.log(`\n-> ${campaignId} (${campaign.pillar} / ${campaign.audience})`);

    try {
      const research = await gatherResearch(concept, campaign);
      const dataBlock = buildDataBlock({
        concept: { ...concept, topic: campaign.name },
        vendors: research.vendors,
        market: marketBlock,
        location: research.location,
        category: research.category,
        audience,
      });

      const raw = await generateJson(buildUserPrompt({ concept, dataBlock }), {
        system: SYSTEM_PROMPT,
      });

      if (!raw || (!raw.instagram && !raw.facebook)) {
        throw new Error('Model returned no platform content');
      }

      for (const platform of PLATFORMS) {
        const variant = raw[platform];
        const post = group.find((p) => p.platform === platform);
        if (!post || !variant) continue;

        assertTransition(post.state, STATES.GENERATED);

        const script = {
          hook: variant.hook || '',
          slides: Array.isArray(variant.slides) ? variant.slides : [],
          shotList: Array.isArray(variant.shotList) ? variant.shotList : [],
          altText: variant.altText || '',
        };

        updatePost(post.id, {
          state: STATES.GENERATED,
          caption: variant.caption || '',
          hashtags: Array.isArray(variant.hashtags) ? variant.hashtags : [],
          cta: variant.cta || '',
          script,
          visualBrief: variant.visualBrief || '',
          vendorRefs: research.vendors.map((v) => ({
            slug: v.public_slug,
            businessName: v.business_name,
            ratingAverage: v.rating,
            ratingCount: v.rating_count,
            claimed: v.claimed_by_the_business,
          })),
        });
        recordEvent(post.id, post.state, STATES.GENERATED, 'generator', 'content generated');

        // Provenance: store exactly what the API said about each vendor used.
        for (const vendor of research.vendors) {
          saveVendorSnapshot({
            slug: vendor.public_slug,
            businessName: vendor.business_name,
            categorySlug: null,
            municipality: vendor.municipality,
            ratingAverage: vendor.rating,
            ratingCount: vendor.rating_count,
            claimed: vendor.claimed_by_the_business,
            verified: vendor.verified,
            raw: vendor,
          });
        }

        writeDraftFile(
          post,
          {
            caption: variant.caption,
            hashtags: variant.hashtags,
            cta: variant.cta,
            script,
            visualBrief: variant.visualBrief,
          },
          STATES.GENERATED,
        );

        generated += 1;
      }
      console.log(`   generated ${group.length} posts`);
    } catch (err) {
      failed += 1;
      console.error(`   FAILED: ${err.message}`);
      for (const post of group) {
        updatePost(post.id, { state: STATES.FAILED, error: err.message });
        recordEvent(post.id, post.state, STATES.FAILED, 'generator', err.message);
      }
    }
  }

  console.log(`\nGenerated ${generated} posts, ${failed} concepts failed.`);
  console.log(`Drafts written to ${path.join(PATHS.content, 'drafts')}`);
  closeDb();
}

main().catch((err) => {
  console.error(err);
  closeDb();
  process.exit(1);
});
