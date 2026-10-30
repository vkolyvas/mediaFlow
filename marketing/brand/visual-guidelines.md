# Visual guidelines

## The photography rule

**We do not use vendor photography.** A vendor's gallery belongs to them, it
shows their work, and republishing it in our feed is both a rights problem
and a credibility problem - it looks like we are claiming the work as ours.

Permitted visual sources, in order of preference:

1. **Brand-native graphics** - typography, gradients, shapes, illustrated
   motifs. This is the default and should cover the majority of the calendar.
2. **Our own product screenshots** - `frontend/public/marketing/*.png` in the
   app repo. These are our interface, and they are exactly what the product
   pillar needs. Crop them, annotate them, place them on brand backgrounds.
3. **Licensed stock** - Unsplash/Pexels, where the licence permits commercial
   social use. Attribution is not required by those licences but a credit in
   the caption is good manners.
4. **Vendor-submitted media** - only where the vendor has explicitly agreed
   in writing that the image may be used on WeddingWise social channels. Keep
   the written agreement; a file in a database is not consent.

Forbidden: images scraped from a vendor's Instagram or website, and the demo
seed rows' Unsplash gallery images, which are stock photographs standing in
for real weddings.

## Format and aspect ratio

| Format | Aspect | Where |
| --- | --- | --- |
| Reel | 9:16 | Discovery, product demo, engagement |
| Carousel | 4:5 | Guides, inspiration |
| Story | 9:16 | Weekend, behind the scenes |
| Feed post | 4:5 | Fallback for text-first posts |

Instagram and Facebook take the same asset set. The Reel is posted to both
with the same 9:16 file; the caption differs because the two platforms have
different link behaviour and a different audience habit.

## The Reel

A Reel is 15-30 seconds. It is not a slideshow and it is not a talking head.

Structure:

```
0-3s   the hook, on screen as text - the specific promise
3-20s  3-5 beats, each one a slide with a headline and one line
20-27s the payoff - what the couple can now do
27-30s the call to action, with the on-screen link
```

- On-screen text is always burned in. Most people watch Reels muted.
- Motion is slow and deliberate: a 400ms fade or a 2% scale drift. Nothing
  bounces.
- Type is Cormorant Garamond for the hook, Bricolage Grotesque for the body.
- The Reel ends on the CTA, not on a logo sting. There is no logo sting.

## The carousel

4-7 slides. Slide 1 is the headline - it has to work as a thumbnail, because
the feed shows it at that size. Last slide is the CTA with the link.

## Colour and background

- Backgrounds are brand washes (`champagne` `#F7E7CE`, `brand50` `#FDF2F4`,
  `slate50` `#F8FAFC`) or a rose-to-gold gradient.
- The rose-to-gold gradient (`#E11D48` → `#C9A962`) is the signature
  treatment. Use it on roughly one post in five, not on every post.
- Text is `slate900` on light backgrounds, white on the gradient.

## Type on screen

- Minimum 48px equivalent for the hook, minimum 28px for body.
- Never more than nine words on a slide.
- No drop shadows, no outlines, no text on a busy photograph without a scrim.

## The logo

Never stretched, never recoloured, never placed on a busy photograph
without a clear area. The gradient rounded-square with the white heart is the
only mark we have.

## Naming and storage

Rendered assets live in `marketing/assets/rendered/<post-id>/`:

```
<post-id>/
  reel-9x16.mp4
  carousel-1.png ... carousel-N.png
  cover.png
  caption.txt
```

`marketing/assets/generated/` holds the source files. Both are gitignored -
they are build output, not source.
