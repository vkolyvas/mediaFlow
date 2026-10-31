// Find where the site's content actually sits in each captured frame.
//
// The app renders its UI inside a narrow column in a 1920px-wide canvas, so a
// 9:16 vertical that crops a fixed window usually lands in the empty gutter
// beside the column. This measures the capture instead of guessing: it reads
// the column ink profile of the scene's screenshot and finds the densest
// window - the part of the page that actually holds the site.
//
// It also bakes the blurred backdrop the vertical uses behind the screen
// strip. Blurring it here rather than in the renderer matters: a CSS blur
// filter on a full-size layer costs gigabytes in the headless compositor and
// stalls the render.
//
// Writes assets/vertical-frames.json and assets/backdrops/<scene>.jpg.
//
//   node lib/vertical-frames.mjs <project>
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const BINS = 240;        // profile resolution (each bin = 8 CSS px)
const VIEW_W = 853;      // CSS px the 9:16 frame shows at full zoom (1920 / 2.25)
const TOLERANCE = 20;    // grey distance from the page background

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

/** Grey column-ink profile of a screenshot: share of rows that differ from the page background. */
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

/** The densest window of VIEW_W CSS px across the capture, in CSS px. */
const densestWindow = (col) => {
  const w = Math.max(1, Math.round((VIEW_W / 1920) * BINS));
  const prefix = new Float64Array(BINS + 1);
  for (let x = 0; x < BINS; x++) prefix[x + 1] = prefix[x] + col[x];
  let bestX = 0;
  let bestV = -1;
  for (let x = 0; x + w <= BINS; x++) {
    const v = prefix[x + w] - prefix[x];
    if (v > bestV) {
      bestV = v;
      bestX = x;
    }
  }
  const x0 = Math.round((bestX / BINS) * 1920);
  return {x0, x1: x0 + VIEW_W, density: bestV / w};
};

const frames = {};
const backdropDir = path.join(assetsDir, 'backdrops');
mkdirSync(backdropDir, {recursive: true});
for (const scene of storyboard.scenes) {
  const shot = path.join(assetsDir, scene.screenshot);
  if (!existsSync(shot)) continue;
  const col = inkProfile(shot);
  const win = densestWindow(col);

  // Where the scene acted: a click is the strongest signal, then the cursor.
  const clicks = (scene.events ?? []).filter((e) => e.type === 'click');
  const moves = scene.events ?? [];
  const median = (list) => {
    if (!list.length) return null;
    const xs = list.map((e) => e.x).sort((a, b) => a - b);
    return xs[Math.floor(xs.length / 2)];
  };
  const subject = median(clicks) ?? median(moves) ?? scene.focus?.x ?? null;

  // The view moves to where the site is (the densest window). When the scene
  // acted inside that window, aim at the element instead of the window's
  // middle - that is what the scene is actually talking about.
  const inWindow = subject !== null && subject >= win.x0 && subject <= win.x1;
  const target = inWindow ? subject : Math.round((win.x0 + win.x1) / 2);

  // The blurred backdrop behind the screen strip, baked small (280x480) and
  // scaled up by the renderer - no blur filter at render time.
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', shot,
      '-vf', 'scale=280:480:force_original_aspect_ratio=increase,crop=280:480,' +
        'gblur=sigma=9,eq=brightness=-0.24:saturation=1.2',
      '-q:v', '6', path.join(backdropDir, `${scene.id}.jpg`)],
  );

  frames[scene.id] = {
    target,
    subject,
    window: [win.x0, win.x1],
    density: Number(win.density.toFixed(4)),
    backdrop: `backdrops/${scene.id}.jpg`,
  };
}

const out = path.join(assetsDir, 'vertical-frames.json');
writeFileSync(out, `${JSON.stringify(frames, null, 2)}\n`);
console.log(`vertical-frames: ${Object.keys(frames).length} scenes analysed -> ${out}`);
for (const [id, f] of Object.entries(frames)) {
  console.log(
    `  ${id.padEnd(24)} densest=[${String(f.window[0]).padStart(4)},${String(f.window[1]).padEnd(4)}] ` +
      `target=${String(f.target).padStart(4)} subject=${String(f.subject ?? '-').padStart(4)}` +
      `${f.subject !== null && f.subject >= f.window[0] && f.subject <= f.window[1] ? ' (on subject)' : ''}`,
  );
}
