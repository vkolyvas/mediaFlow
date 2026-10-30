# WeddingWise brand guidelines (social)

This is the subset of the WeddingWise brand that applies to social content.
The tokens live in code in `marketing/lib/config.mjs` (`BRAND`) so the
automation and the templates read from one place.

## What we are

WeddingWise is the directory where a couple planning a wedding in Greece finds
and compares the people who make it happen - photographers, venues, DJs,
florists, planners. We are a tool, not a wedding magazine, and not an
influencer. The brand promise is *find the right people, faster*.

## What we are not

- We are not a wedding magazine. We do not publish editorial opinion about
  venues, catering or trends.
- We are not an influencer. There is no "you" in the brand voice; there is
  "you" in the second person, addressed to the couple, but there is no
  personality claiming to have been there.
- We are not a vendor's marketing department. We do not publish a vendor's
  claims as if they were ours, and we do not imply that a vendor endorses us
  unless that vendor is claimed and has said so.

## Colours

| Token | Hex | Use |
| --- | --- | --- |
| `rose` | `#E11D48` | Primary action colour, headline accents |
| `roseLight` | `#FB7185` | Secondary accent, gradients |
| `brand600` | `#C93A5F` | Buttons, links |
| `brand700` | `#A32F4D` | Hover / pressed |
| `brand50` | `#FDF2F4` | Card backgrounds |
| `brand100` | `#FCE4E8` | Chip / badge fills |
| `gold` | `#C9A962` | Premium accent, separators |
| `champagne` | `#F7E7CE` | Warm background wash |
| `slate900` | `#0F172A` | Body text |
| `slate600` | `#475569` | Secondary text |
| `slate50` | `#F8FAFC` | Page background |

Rose and gold are the couple-facing warmth; slate keeps it legible. Never
introduce a new hue for social - if a visual needs a colour that is not in
this table, it is using a photograph, and the photograph rule applies.

## Type

- **Bricolage Grotesque** - headlines, numerals, UI labels.
- **Cormorant Garamond** - pull quotes and large Greek headlines. It is a
  display face; it never carries body copy.
- Body copy is the same sans, at the size that is readable on a phone in
  daylight.

## Logo

There is no standalone logo file in the app. The mark is the gradient
rounded-square with a white heart from `frontend/public/favicon.svg`. Social
avatars use that mark. We do not stretch it, outline it, or recolour it.
`marketing/assets/` holds the rendered avatar set.

## The three restrictions

These are not style preferences. They are the rules that keep the brand
trustworthy, and they override anything else in this document.

1. **We do not republish vendor photography.** We do not download and repost
   a vendor's gallery images. Visuals are brand-native (typography, gradient,
   illustration) or assets we are licensed to use, or images a vendor has
   submitted to us and agreed may be used.
2. **We do not imply endorsement.** A vendor who has not claimed their
   profile is a *listing*, not a *partner*. We say "a photographer in the
   WeddingWise directory", never "our photographer" and never "our partner
   X". The distinction is visible in the copy, not just in the caption.
3. **We do not invent urgency or social proof.** No "500 couples found their
   vendor this week" unless the analytics say exactly that. No "12 vendors
   left this month" unless it is true. No invented enquiries, reviews or
   profile views.

The automated validator enforces all three, and a human approves everything
before it is scheduled.

## Voice in one line

Warm, specific, unhurried, and never boastful.
