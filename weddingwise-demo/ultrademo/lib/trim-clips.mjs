// Trim the grey padding out of a recorded clip.
//
// Playwright pads the recording to `recordVideo.size` instead of scaling it,
// and Chromium's screencast captures at CSS resolution - so a recording made
// with a 3840x2160 request holds the 1920x1080 page in the top-left corner
// and flat grey (RGB 128) everywhere else. The 9:16 reel cropped that canvas
// and cut the 9:16 window mostly out of the padding, which is why the reel
// read as "the grey area shows only".
//
// This cuts the page back out of the padded frame, in place. It only touches a
// clip whose area outside the viewport is uniform, so a recording that really
// does fill its frame is left alone.
//
//   node lib/trim-clips.mjs <project>
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, renameSync} from 'node:fs';
import path from 'node:path';

const VIEWPORT = {width: 1920, height: 1080};

const project = process.argv[2];
if (!project) {
  console.error('Usage: node lib/trim-clips.mjs <project>');
  process.exit(1);
}

const assetsDir = path.resolve('projects', project, 'assets');
const sbPath = path.join(assetsDir, 'storyboard.json');
if (!existsSync(sbPath)) {
  console.error(`${project}: no storyboard at ${sbPath}`);
  process.exit(1);
}
const storyboard = JSON.parse(readFileSync(sbPath, 'utf8'));

const probe = (file) => {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file],
    {encoding: 'utf8'},
  ).trim();
  const [w, h] = out.split(',').map(Number);
  return {w, h};
};

// The luma histogram of a region of the clip. The padding is one flat colour,
// so a region that is padding has one dominant luma; a region that holds page
// content does not. (A luma *range* is the wrong test here: compression noise
// alone can spread the padding over 20+ units.)
const lumaHistogram = (file, n, cropExpr) => {
  const buf = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n}),${cropExpr},format=gray`,
      '-frames:v', '1', '-f', 'rawvideo', '-'],
    {maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']},
  );
  if (!buf.length) return null;
  const hist = new Uint32Array(256);
  for (let i = 0; i < buf.length; i++) hist[buf[i]]++;
  let mode = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[mode]) mode = v;
  let within = 0;
  for (let v = Math.max(0, mode - 12); v <= Math.min(255, mode + 12); v++) within += hist[v];
  return {mode, share: within / buf.length};
};

// The padding is an L-shape: a strip right of the viewport and a strip below
// it. Both have to be flat.
const paddingFlat = (file, n) => {
  const {w, h} = probe(file);
  if (w <= VIEWPORT.width && h <= VIEWPORT.height) return false;
  const strips = [];
  if (w > VIEWPORT.width) {
    strips.push(`crop=${w - VIEWPORT.width}:${h}:${VIEWPORT.width}:0`);
  }
  if (h > VIEWPORT.height) {
    strips.push(`crop=${w}:${h - VIEWPORT.height}:0:${VIEWPORT.height}`);
  }
  return strips.every((s) => {
    const stats = lumaHistogram(file, n, s);
    // The browser cannot paint outside the viewport, so anything out there is
    // either the recorder's padding (one flat colour, whatever its value) or a
    // scaled-up picture (page content, no dominant luma).
    return stats !== null && stats.share >= 0.95;
  });
};

let trimmed = 0;
for (const scene of storyboard.scenes) {
  if (!scene.clip) continue;
  const file = path.join(assetsDir, scene.clip);
  if (!existsSync(file)) continue;
  const {w, h} = probe(file);
  if (w <= VIEWPORT.width && h <= VIEWPORT.height) continue;

  // Two frames: the first and one from the middle of the clip.
  const last = Math.max(0, Number(execFileSync(
    'ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
      '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file],
    {encoding: 'utf8'},
  ).trim()) - 1);
  const flat = [paddingFlat(file, 0), paddingFlat(file, Math.floor(last / 2))];
  if (!flat.every(Boolean)) {
    console.log(`  ${scene.id.padEnd(24)} ${w}x${h} - not flat padding, left alone`);
    continue;
  }

  const tmp = `${file}.trim.mp4`;
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', file,
      '-vf', `crop=${VIEWPORT.width}:${VIEWPORT.height}:0:0`,
      '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-r', '30', '-movflags', '+faststart', tmp],
    {stdio: 'inherit'},
  );
  renameSync(tmp, file);
  trimmed++;
  console.log(`  ${scene.id.padEnd(24)} ${w}x${h} -> ${VIEWPORT.width}x${VIEWPORT.height}`);
}

console.log(`trim-clips: ${trimmed} clips trimmed -> ${assetsDir}/captures`);
