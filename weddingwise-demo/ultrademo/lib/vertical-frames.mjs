// Find where the site's content actually sits in each captured frame, and
// measure the 9:16 window the vertical should cut out of it.
//
// The app renders its UI inside a narrow column in a 1920px-wide canvas, so a
// 9:16 vertical that slices the page at an arbitrary column lands in the
// empty gutter beside the column. This measures the capture instead of
// guessing: it reads the column ink profile of the scene's screenshot, finds
// the bands that actually hold the site, and aims a 9:16 window at the band
// the scene is about.
//
// The window is 9:16 of the captured page height (607.5 CSS px of a 1080 CSS
// px tall page). The clip is recorded at 1x (Chromium's screencast ignores
// deviceScaleFactor), so the window is an upscale to 1080x1920 - but it is cut
// offline with lanczos, which stays far sharper than the CSS transform on a
// video element that this used to be.
//
// Writes assets/vertical-frames.json.
//
//   node lib/vertical-frames.mjs <project>
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const BINS = 480;        // profile resolution (each bin = 4 CSS px)
const PAGE_W = 1920;     // captured page width in CSS px
const PAGE_H = 1080;     // captured page height in CSS px
const CROP_W = PAGE_H * 9 / 16; // 607.5 CSS px - a 9:16 window of the page
const TOLERANCE = 20;    // grey distance from the page background
const BAND_MIN = 0.10;   // a column counts as content at this share of rows
const MERGE_BINS = 6;    // gaps below this (24 CSS px) join two bands

const project = process.argv[2];
if (!project) {
  console.error('Usage: node lib/vertical-frames.mjs <project>');
  process.exit(1);
}

const assetsDir = path.resolve('projects', project, 'assets');
const sbPath = path.join(assetsDir, 'storyboard.json');
if (!existsSync(sbPath)) {
  console.error(`${project}: no storyboard at ${sbPath}`);
  process.exit(1);
}
const storyboard = JSON.parse(readFileSync(sbPath, 'utf8'));

/** Grey column-ink profile of a capture: share of rows that differ from the page background. */
const inkProfile = (file) => {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `scale=${BINS}:-1,format=gray`, '-f', 'rawvideo', '-'],
    {maxBuffer: 1 << 28},
  );
  const h = raw.length / BINS;
  // the page background is its most common grey
  const hist = new Uint32Array(256);
  for (const b of raw) hist[b]++;
  let bg = 0;
  for (let i = 1; i < 256; i++) if (hist[i] > hist[bg]) bg = i;
  const col = new Float64Array(BINS);
  for (let y = 0; y < h; y++) {
    const row = y * BINS;
    for (let x = 0; x < BINS; x++) {
      if (Math.abs(raw[row + x] - bg) > TOLERANCE) col[x]++;
    }
  }
  for (let x = 0; x < BINS; x++) col[x] /= h;
  return col;
};

const toCss = (bin) => (bin / BINS) * PAGE_W;

/**
 * The bands of the page that actually hold the site: runs of columns with
 * enough ink, with the small gaps between them joined back together.
 */
const contentBands = (col) => {
  const bins = [];
  for (let x = 0; x < BINS; x++) if (col[x] >= BAND_MIN) bins.push(x);
  if (!bins.length) return [];
  const bands = [];
  let start = bins[0];
  let prev = bins[0];
  for (const x of bins.slice(1)) {
    if (x - prev > MERGE_BINS) {
      bands.push([start, prev + 1]);
      start = x;
    }
    prev = x;
  }
  bands.push([start, prev + 1]);
  // a band has to be wide enough to be a column of the app, not a stray pixel
  return bands.filter(([a, b]) => toCss(b) - toCss(a) >= 40);
};

const inkIn = (col, x0, x1) => {
  let sum = 0;
  let n = 0;
  for (let x = 0; x < BINS; x++) {
    const css = toCss(x);
    if (css >= x0 && css < x1) {
      sum += col[x];
      n++;
    }
  }
  return n ? sum / n : 0;
};

/** Total ink in a span: a wide content column outranks a narrow nav rail. */
const inkTotal = (col, x0, x1) => {
  let sum = 0;
  for (let x = 0; x < BINS; x++) {
    const css = toCss(x);
    if (css >= x0 && css < x1) sum += col[x];
  }
  return sum;
};

const frames = {};
for (const scene of storyboard.scenes) {
  const shot = path.join(assetsDir, scene.screenshot);
  if (!existsSync(shot)) continue;
  const col = inkProfile(shot);
  const bands = contentBands(col);

  // Where the scene acted: a click is the strongest signal, then the cursor.
  const clicks = (scene.events ?? []).filter((e) => e.type === 'click');
  const moves = scene.events ?? [];
  const median = (list) => {
    if (!list.length) return null;
    const xs = list.map((e) => e.x).sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)];
  };
  const subject = median(clicks) ?? median(moves) ?? scene.focus?.x ?? null;

  // Candidate windows: one per content band, centred on the band (or on the
  // click, when the click landed inside it).
  const candidates = bands.map((b) => {
    const a = toCss(b[0]);
    const width = toCss(b[1]) - a;
    const onSubject = subject !== null && subject >= a && subject <= toCss(b[1]);
    const x = Math.round(
      width <= CROP_W ? a + width / 2 - CROP_W / 2 : onSubject ? subject - CROP_W / 2 : a,
    );
    const clamped = Math.max(0, Math.min(PAGE_W - CROP_W, x));
    return {band: b, x: clamped, onSubject, ink: inkTotal(col, clamped, clamped + CROP_W)};
  });
  const best = candidates.slice().sort((p, q) => q.ink - p.ink)[0];
  // Follow the click when it landed on the site and that band holds nearly as
  // much content as the best one; otherwise take the richest band. A click can
  // land in a gap between two bands (the page's own padding) - following that
  // would point the crop at empty page again.
  const subjectBand = candidates.find((c) => c.onSubject);
  const chosen =
    subjectBand && subjectBand.ink >= best.ink * 0.8 ? subjectBand : best ?? null;

  let cropX;
  if (!chosen) {
    cropX = Math.round((PAGE_W - CROP_W) / 2);
  } else {
    cropX = Math.max(0, Math.min(PAGE_W - CROP_W, chosen.x));
  }
  const band = chosen ? chosen.band : null;

  frames[scene.id] = {
    cropX,
    cropW: CROP_W,
    cropH: PAGE_H,
    band: band ? [Math.round(toCss(band[0])), Math.round(toCss(band[1]))] : null,
    subject,
    density: Number(inkIn(col, cropX, cropX + CROP_W).toFixed(4)),
    // filled in by lib/vertical-crops.mjs
    asset: null,
  };
}

const out = path.join(assetsDir, 'vertical-frames.json');
writeFileSync(out, `${JSON.stringify(frames, null, 2)}\n`);
console.log(`vertical-frames: ${Object.keys(frames).length} scenes analysed -> ${out}`);
for (const [id, f] of Object.entries(frames)) {
  console.log(
    `  ${id.padEnd(24)} crop x=[${String(Math.round(f.cropX)).padStart(4)},` +
      `${String(Math.round(f.cropX + f.cropW)).padStart(4)}] band=${f.band ? `[${f.band[0]},${f.band[1]}]` : 'none'} ` +
      `ink=${f.density.toFixed(3)}`,
  );
}
