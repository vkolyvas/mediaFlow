/**
 * Renders a post's script into the media the platform needs.
 *
 * The engine's generator writes *copy* - a hook, carousel slides, a shot list
 * - and a visual brief for a designer. What it cannot do is produce a file
 * that Instagram will accept. This module closes that gap the way the brand
 * guidelines say it should be closed: with brand-native graphics, built from
 * the brand's own type and colour, and no photography at all.
 *
 * A carousel becomes 4:5 PNGs, one per slide plus a closing call to action.
 * A reel becomes a 9:16 MP4: the hook, one frame per shot, and the call to
 * action, cross-faded over 400ms and silent, because most people watch muted.
 *
 * The rendering is deterministic. The same post renders the same files, so a
 * re-run after a copy edit produces a diff nobody has to eyeball.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BRAND, PATHS } from './config.mjs';

const execFileAsync = promisify(execFile);

/** The two brand fonts, vendored under brand/fonts (SIL Open Font License). */
const FONT_FILES = {
  serif: 'CormorantGaramond[wght].ttf',
  sans: 'BricolageGrotesque[opsz,wdth,wght].ttf',
};

/**
 * Neither brand font covers Greek, so the stack falls through to Lato (on
 * every host we deploy to) for Greek glyphs. Without the fallback a Greek
 * post would render in a default serif that does not match the brand.
 */
const FONT_STACKS = {
  serif: `"Cormorant Garamond", Lato, "DejaVu Serif", serif`,
  sans: `"Bricolage Grotesque", Lato, "DejaVu Sans", sans-serif`,
};

const SIZES = {
  carousel: { width: 1080, height: 1350 },
  reel: { width: 1080, height: 1920 },
  story: { width: 1080, height: 1920 },
  feed_post: { width: 1080, height: 1350 },
};

/** Seconds per reel beat. The hook gets longer; the CTA gets longer still. */
const REEL_TIMING = { hook: 3.0, shot: 3.0, cta: 4.0, fade: 0.4 };

const fontCache = new Map();

/** The font files as data URLs - a file:// page cannot always load a local font. */
function fontFaceCss() {
  if (fontCache.size) return fontCache.get('css');
  const dir = path.join(PATHS.brand, 'fonts');
  const faces = Object.entries(FONT_FILES)
    .map(([family, file]) => {
      const full = path.join(dir, file);
      const data = fs.readFileSync(full).toString('base64');
      return `@font-face { font-family: "${family === 'serif' ? 'Cormorant Garamond' : 'Bricolage Grotesque'}";` +
        ` src: url("data:font/ttf;base64,${data}") format("truetype");` +
        ` font-weight: 100 900; font-style: normal; }`;
    })
    .join('\n');
  const css = `${faces}\n:root { --serif: ${FONT_STACKS.serif}; --sans: ${FONT_STACKS.sans}; }`;
  fontCache.set('css', css);
  return css;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlights the numerals in a line. The brand's own briefs ask for rose
 * highlights on the figures, and a number is the only thing in a slide worth
 * pointing at. It marks up what is already there - it never adds one.
 */
function highlightNumbers(text) {
  return escapeHtml(text).replace(/\b(\d[\d.,]*)\b/g, '<span class="num">$1</span>');
}

/** The link without its tracking parameters - the slide is not the tracking surface. */
export function readableUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '');
  } catch {
    return String(url);
  }
}

/**
 * The slides of a carousel: the generated ones, plus a closing call to
 * action. The hook rides along as a kicker on the first slide rather than as
 * a slide of its own, so a carousel stays inside the 4-7 slides the brand
 * guidelines allow.
 */
export function carouselSpecs(post) {
  const script = post.script || {};
  const slides = Array.isArray(script.slides) ? script.slides : [];
  const specs = slides.map((slide, index) => ({
    kind: 'slide',
    kicker: index === 0 ? script.hook || '' : '',
    headline: slide.headline || '',
    body: slide.body || '',
    alt: script.altText || post.title || '',
  }));
  specs.push({
    kind: 'cta',
    kicker: '',
    headline: post.cta || 'See the listings on WeddingWise',
    body: readableUrl(post.utmUrl || post.linkUrl),
    alt: `The call to action: ${post.cta || 'see the listings on WeddingWise'}.`,
  });
  return specs;
}

/** The frames of a reel: the hook, one per shot, and the call to action. */
export function reelSpecs(post) {
  const script = post.script || {};
  const shots = Array.isArray(script.shotList) ? script.shotList : [];
  const specs = [
    {
      kind: 'hook',
      headline: script.hook || post.title || '',
      body: '',
      alt: script.altText || post.title || '',
    },
    ...shots.map((shot) => ({
      kind: 'shot',
      headline: shot.onScreenText || '',
      body: '',
      alt: script.altText || post.title || '',
    })),
    {
      kind: 'cta',
      headline: post.cta || 'See the listings on WeddingWise',
      body: readableUrl(post.utmUrl || post.linkUrl),
      alt: `The call to action: ${post.cta || 'see the listings on WeddingWise'}.`,
    },
  ];
  return specs;
}

/**
 * Whether a post gets the rose-to-gold gradient. The brand says one post in
 * five, not every post - the fingerprint decides, so the choice is stable for
 * a given post across renders.
 */
export function usesGradient(post) {
  const fingerprint = String(post.fingerprint || post.id || '');
  let sum = 0;
  for (let i = 0; i < fingerprint.length; i += 1) sum += fingerprint.charCodeAt(i);
  return sum % 5 === 0;
}

function pageShell({ size, gradient, body }) {
  const { width, height } = size;
  const background = gradient
    ? `linear-gradient(150deg, ${BRAND.rose} 0%, ${BRAND.gold} 100%)`
    : `linear-gradient(160deg, ${BRAND.champagne} 0%, ${BRAND.brand50} 55%, ${BRAND.slate50} 100%)`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${fontFaceCss()}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: ${width}px; height: ${height}px; overflow: hidden;
  background: ${background};
  font-family: var(--sans);
  color: ${gradient ? '#FFFFFF' : BRAND.slate900};
  -webkit-font-smoothing: antialiased;
}
.num { color: ${gradient ? '#FFFFFF' : BRAND.rose}; }
.frame {
  width: ${width}px; height: ${height}px;
  display: flex; flex-direction: column;
  padding: ${Math.round(width * 0.093)}px;
}
.kicker {
  font-family: var(--serif);
  font-size: ${Math.round(width * 0.038)}px;
  font-style: italic;
  font-weight: 600;
  line-height: 1.25;
  color: ${gradient ? 'rgba(255,255,255,0.92)' : BRAND.rose};
  margin-bottom: ${Math.round(width * 0.035)}px;
}
.headline {
  font-family: var(--sans);
  font-weight: 800;
  font-size: ${Math.round(width * 0.082)}px;
  line-height: 1.06;
  letter-spacing: -0.02em;
  margin-bottom: ${Math.round(width * 0.038)}px;
}
.body {
  font-family: var(--sans);
  font-weight: 400;
  font-size: ${Math.round(width * 0.040)}px;
  line-height: 1.35;
  color: ${gradient ? 'rgba(255,255,255,0.95)' : BRAND.slate600};
  overflow-wrap: anywhere;
}
.fit { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
.foot {
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--serif);
  font-size: ${Math.round(width * 0.030)}px;
  letter-spacing: 0.02em;
  color: ${gradient ? 'rgba(255,255,255,0.85)' : BRAND.gold};
}
.foot .mark { font-family: var(--sans); font-weight: 600; color: ${gradient ? 'rgba(255,255,255,0.9)' : BRAND.slate600}; }
.link { font-family: var(--sans); font-weight: 600; font-size: ${Math.round(width * 0.034)}px; color: ${gradient ? '#FFFFFF' : BRAND.rose}; word-break: break-all; }
.counter { font-family: var(--serif); font-size: ${Math.round(width * 0.028)}px; color: ${gradient ? 'rgba(255,255,255,0.8)' : BRAND.gold}; }
</style></head>
<body>${body}</body></html>`;
}

function slideBody(spec, { index, total, gradient }) {
  const kicker = spec.kicker ? `<div class="kicker">${escapeHtml(spec.kicker)}</div>` : '';
  const headline = `<h1 class="headline" data-fit>${highlightNumbers(spec.headline)}</h1>`;
  // The closing slide carries the link and nothing else - rendering the URL
  // as body text as well would print it twice on the same slide.
  const body = spec.body && spec.kind !== 'cta'
    ? `<p class="body" data-fit>${escapeHtml(spec.body)}</p>`
    : '';
  const link = spec.kind === 'cta' && spec.body
    ? `<p class="link">${escapeHtml(spec.body)}</p>`
    : '';
  const foot = `<div class="foot"><span class="mark">WeddingWise</span>` +
    `<span class="counter">${index + 1} / ${total}</span></div>`;
  return `<div class="frame"><div class="fit">${kicker}${headline}${body}${link}</div>${foot}</div>`;
}

export function carouselHtml(post, spec, options) {
  return pageShell({
    ...options,
    body: slideBody(spec, options),
  });
}

export function reelHtml(post, spec, options) {
  const hook = spec.kind === 'hook';
  const size = options.size;
  const body = `
<div class="frame" style="justify-content:center">
  <div class="fit" style="justify-content:center">
    ${hook ? `<div class="kicker" style="font-size:${Math.round(size.width * 0.036)}px">WeddingWise</div>` : ''}
    <h1 class="headline" data-fit style="font-size:${Math.round(size.width * (hook ? 0.098 : 0.082))}px;${hook ? "font-family:var(--serif);font-weight:600;letter-spacing:0;" : ''}">${escapeHtml(spec.headline)}</h1>
    ${spec.kind === 'cta' && spec.body ? `<p class="link">${escapeHtml(spec.body)}</p>` : ''}
  </div>
</div>`;
  return pageShell({ ...options, body });
}

/**
 * Shrinks the text until it fits the space it was given.
 *
 * The space available to an element is its parent's height minus whatever
 * its siblings already take - a headline that shares a box with a kicker and
 * a body paragraph cannot use the whole box. The floors are the brand's
 * minimum sizes; below them the text would be unreadable on a phone, so it
 * is left to overflow rather than be shrunk into illegibility.
 */
const FIT_SCRIPT = `() => {
  const FLOORS = { headline: 48, body: 28, kicker: 24, link: 28 };
  for (const el of document.querySelectorAll('[data-fit]')) {
    const box = el.parentElement;
    const style = getComputedStyle(el);
    const floor = FLOORS[el.classList[0]] || 24;
    const siblings = Array.from(box.children).filter((c) => c !== el);
    const used = siblings.reduce((sum, c) => sum + c.getBoundingClientRect().height, 0);
    const avail = box.clientHeight - used
      - (parseFloat(style.marginTop) || 0) - (parseFloat(style.marginBottom) || 0);
    if (avail <= 0) continue;
    let size = parseFloat(style.fontSize);
    let guard = 0;
    while (el.scrollHeight > avail && size > floor && guard < 200) {
      size -= 2;
      el.style.fontSize = size + 'px';
      guard += 1;
    }
  }
}`;

async function withBrowser(fn) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

/** Renders one HTML page to a PNG. */
async function renderPng(html, outPath, { width, height }) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  // The page has to be a real file: a data: URL cannot load a data-URL font
  // reliably, and Chromium blocks file:// subresources from a data: page.
  const tmp = `${outPath}.html`;
  fs.writeFileSync(tmp, html);
  try {
    await withBrowser(async (page) => {
      await page.setViewportSize({ width, height });
      await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
      await page.evaluate(FIT_SCRIPT);
      await page.screenshot({ path: outPath, type: 'png' });
    });
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** Builds the reel's frames and returns them with their durations. */
async function renderReelFrames(post, specs, dir) {
  const size = SIZES.reel;
  const gradient = usesGradient(post);
  const frames = [];
  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const file = path.join(dir, `frame-${String(index + 1).padStart(2, '0')}.png`);
    const html = reelHtml(post, spec, { size, gradient });
    await renderPng(html, file, size);
    const seconds =
      spec.kind === 'hook' ? REEL_TIMING.hook : spec.kind === 'cta' ? REEL_TIMING.cta : REEL_TIMING.shot;
    frames.push({ file, seconds, index });
  }
  return frames;
}

/**
 * Cross-fades the frames into a silent MP4. The offsets are cumulative:
 * each xfade starts where the previous one ended, minus the overlap.
 */
async function assembleReel(frames, outPath) {
  const fade = REEL_TIMING.fade;
  const args = [];
  for (const frame of frames) {
    args.push('-loop', '1', '-t', String(frame.seconds), '-i', frame.file);
  }
  const filters = frames.map((_, i) => `[${i}:v]setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${i}]`);
  let last = 'v0';
  let elapsed = frames[0].seconds;
  for (let i = 1; i < frames.length; i += 1) {
    const offset = Math.max(0, elapsed - fade);
    const next = `x${i}`;
    filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}[${next}]`);
    last = next;
    elapsed += frames[i].seconds - fade;
  }
  args.push(
    '-filter_complex', filters.join(';'),
    '-map', `[${last}]`,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-an',
    '-y', outPath,
  );
  await execFileAsync(process.env.FFMPEG_PATH || 'ffmpeg', args, { maxBuffer: 1024 * 1024 * 16 });
}

/**
 * What a post's media will be, before anything is drawn: the directory, the
 * frames, and the paths the scheduler will look for.
 *
 * The paths are relative to the assets directory, which is where the
 * scheduler resolves them from.
 */
export function planPost(post, { assetsDir } = {}) {
  const root = path.resolve(assetsDir || PATHS.assets);
  const format = post.format || 'carousel';
  const dir = path.join(root, 'rendered', post.id);

  if (format === 'reel') {
    const specs = reelSpecs(post);
    if (!specs.length) throw new Error('a reel needs a shot list before it can be rendered');
    const alt = post.script?.altText || post.title || '';
    return {
      format,
      dir,
      specs,
      media: [{ path: path.join('rendered', post.id, 'reel-9x16.mp4'), alt }],
    };
  }

  const specs = carouselSpecs(post);
  if (specs.length < 2) throw new Error('a carousel needs its slides before it can be rendered');
  const total = specs.length;
  const media = specs.map((spec, index) => ({
    path: path.join('rendered', post.id, `carousel-${index + 1}.png`),
    alt: `${spec.alt} (slide ${index + 1} of ${total})`.trim(),
  }));
  return { format, dir, specs, media };
}

/**
 * Renders one post and returns the media entries for it.
 */
export async function renderPost(post, { assetsDir, force = false } = {}) {
  const plan = planPost(post, { assetsDir });
  const { format, dir, specs, media } = plan;
  const size = SIZES[format] || SIZES.carousel;
  const gradient = usesGradient(post);

  if (format === 'reel') {
    const mp4 = path.join(dir, 'reel-9x16.mp4');
    const cover = path.join(dir, 'cover.png');
    if (force || !fs.existsSync(mp4)) {
      fs.mkdirSync(dir, { recursive: true });
      const frames = await renderReelFrames(post, specs, dir);
      await assembleReel(frames, mp4);
      fs.copyFileSync(frames[0].file, cover);
      for (const frame of frames) fs.rmSync(frame.file, { force: true });
    }
  } else {
    const total = specs.length;
    for (let index = 0; index < specs.length; index += 1) {
      const spec = specs[index];
      const file = path.join(dir, `carousel-${index + 1}.png`);
      if (force || !fs.existsSync(file)) {
        const html = carouselHtml(post, spec, { size, gradient, index, total });
        await renderPng(html, file, size);
      }
    }
  }

  fs.writeFileSync(path.join(dir, 'caption.txt'), `${post.caption || ''}\n`);
  return { media, dir };
}
