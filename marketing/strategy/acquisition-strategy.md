# Acquisition strategy

## The one-line version

Social is not the product. Social is the top of a funnel whose bottom is a
couple registering on WeddingWise and then contacting a vendor. Every post
carries a link to the most specific page that has inventory, every link
carries a UTM campaign string, and every registration and enquiry is
attributed back to the post that produced it.

## Why a social engine and not a campaign

The failure mode for a marketplace directory is a large catalogue and no
audience. WeddingWise has 3,141 listings and, at the time of writing, zero
registered couples. Posting is the cheapest way to put the catalogue in front
of the people who need it, and it is the only channel where the inventory is
the content - there is no other reason to look at a list of photographers in
Athens unless you are planning a wedding in Athens.

## The three jobs

**1. Reach couples who are planning.** The inspiration and engagement pillars.
Measured on reach and profile visits, judged on whether the right people saw
it.

**2. Send the right couple to the right page.** The guides and discovery
pillars. Measured on clicks and on the registration rate per click.

**3. Convert the click.** The product pillar. Measured on registrations.

## Attribution

Every link is built by `lib/utm.mjs`:

```
utm_source   = weddingwise
utm_medium   = social
utm_campaign = ww_{audience}_{pillar}_{target}_{yyyymmdd}
utm_content  = {platform}_{fingerprint8}
utm_term     = optional
```

The campaign string is written into the `campaigns` table once and never
rewritten, so it is a stable join key between a post and the registration
that came back from it.

The site currently strips query strings - the first-party tracker records the
pathname only, and GA4 is sent with the query removed. Attribution therefore
required a change in the app repo: a capture at the edge that stores the UTM
parameters against the existing session id, attached to
`funnel.signup_completed` and to `vendor_leads`, exposed through a read-only
internal endpoint. That branch is `feature/weddingwise-utm-capture` in
`auth-weddingwise`.

**Until that is deployed, registrations cannot be attributed and the weekly
report can rank reach but not outcomes.** The report says so explicitly
rather than presenting a zero as a result.

## The weekly loop

```
Monday    collect conversions + metrics     (what happened)
          write the weekly report            (what it means)
          review the recommendation          (what to change)
          calendar the next week              (what to make)
```

`npm run collect` then `npm run report` then read `analytics/weekly-reports/`.
The recommendation in section 5 is derived from the data, not written by hand:
the pillar with the best conversion-per-engagement gets more, the pillars
that reached people and produced no registration get a different call to
action rather than more of the same, and the reach pillar stays in the
calendar even when it converts badly, because it is what feeds the others.

## What is deliberately not measured

- **Follower count.** It is a vanity metric. It appears nowhere in the
  report.
- **Likes as a goal.** Likes are recorded because they are part of the
  engagement count, but the question the report asks is which content
  produces registrations rather than likes.
- **Impressions as a goal.** Recorded as a denominator. Not a target.

## The rules that keep this honest

These are enforced in code, in `lib/validate.mjs`, and every post passes
through them before a human sees it:

1. Only facts present in the vendor snapshot may appear. No invented vendor
   names, ratings, review counts, prices or availability.
2. No superlative claim about a named vendor. "Top 5 photographers" is
   rejected; "5 photographers to discover in Athens" is not.
3. No implied endorsement of an unclaimed vendor.
4. No fabricated urgency or social proof.
5. Every link is checked to resolve, and every landing page must be a page
   that exists on the site.
6. No duplicate or near-duplicate content in the calendar.
7. Nothing is scheduled without a human approving it.

## The vendor side (P2)

The directory currently has zero claimed vendors. Claiming is what turns a
listing into a working relationship: a vendor controls their own details, and
enquiries route to them instead of nowhere.

That is a separate, human-run campaign, and it is deliberately not automated
here:

- No unsolicited automated DMs, on any platform.
- No automated bulk email. Curated lists, human-written copy, human review.
- The social content that supports it is the visibility argument, which the
  discovery pillar already makes.

## Cost

The engine itself is free to run: Node's standard library, `node:sqlite`, and
one HTTP call to the Anthropic API per concept. Postiz is self-hosted and
AGPL-3.0 - the obligations are in `infra/postiz/README.md`.

The real cost is attention: a human reviews every post before it goes out.
That is the design, not a limitation. An automated social account for a
marketplace that publishes wrong facts about real named businesses is a
liability that grows with reach.
