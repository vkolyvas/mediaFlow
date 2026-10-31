// Cut the 9:16 window the vertical shows out of each scene's capture.
//
// The vertical used to crop the page in the renderer, with a CSS transform on
// an ancestor of the <video> element. Chromium does not rasterise a video
// element that way: inside the transformed, clipped strip the video painted
// only a fraction of its own frame, and the rest of the 1080x1920 canvas was
// the flat grey backdrop - the reel read as "the grey area shows only".
//
// So the crop happens here, offline, with ffmpeg. The capture is recorded at
// 2x (3840x2160 for a 1920x1080 page), so cutting a 9:16 window (1215x2160
// device px) and scaling it to 1080x1920 is a downscale: sharp, and no
// transform in the renderer at all.
//
// Writes assets/vertical/<scene>.mp4 (clips), assets/vertical/<scene>.png
// (the end-state still of every scene) and records the paths plus the crop
// geometry in assets/vertical-frames.json.
//
//   node lib/vertical-crops.mjs <project> [--no-push]
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const OUT_W = 1080;
const OUT_H = 1920;
const PAGE_W = 1920;  // the captured page width in CSS px
const PUSH = 0.08;    // slow push-in over the clip, as a share of the crop
const FPS = 30;       // the capture frame rate

const args = process.argv.slice(2);
const project = args.find((a) => !a.startsWith('--'));
const push = !args.includes('--no-push');
if (!project) {
  console.error('Usage: node lib/vertical-crops.mjs <project> [--no-push]');
  process.exit(1);
}

const assetsDir = path.resolve('projects', project, 'assets');
const outDir = path.join(assetsDir, 'vertical');
const sbPath = path.join(assetsDir, 'storyboard.json');
const vfPath = path.join(assetsDir, 'vertical-frames.json');
if (!existsSync(sbPath) || !existsSync(vfPath)) {
  console.error(`${project}: run lib/vertical-frames.mjs first`);
  process.exit(1);
}
const storyboard = JSON.parse(readFileSync(sbPath, 'utf8'));
const frames = JSON.parse(readFileSync(vfPath, 'utf8'));

const probe = (file) => {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration', '-of', 'csv=p=0', file],
    {encoding: 'utf8'},
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const [w, h] = out[0].split(',').map(Number);
  const duration = out[1] ? Number(out[1]) : 0;
  return {w, h, duration};
};

execFileSync('mkdir', ['-p', outDir]);

// The 9:16 window of a source of the given size, in device px. The left edge
// comes from the measurement (CSS px) mapped onto the source.
const windowOf = (srcW, srcH, cropXCss) => {
  const cropH = srcH;
  const cropW = Math.round((srcH * 9) / 16);
  const cropX = Math.max(0, Math.min(srcW - cropW, Math.round((cropXCss / PAGE_W) * srcW)));
  return {cropW, cropH, cropX};
};

// The push-in: the window shrinks a little over the clip, centred on the same
// spot. Baked here rather than animated in the renderer, which cannot scale a
// video element. ffmpeg's crop filter sizes the output at config time, so the
// zoom is a separate zoompan stage on the already-scaled 1080x1920 frame.
const PUSH_ZOOM = (push, frames) =>
  `zoompan=z='1+${push}*on/${frames - 1}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` +
  `:d=1:s=${OUT_W}x${OUT_H}:fps=30`;

const even = (n) => Math.floor(n / 2) * 2;

let count = 0;
for (const scene of storyboard.scenes) {
  const measured = frames[scene.id];
  if (!measured) continue;
  const isClip = scene.media === 'clip' && scene.clip && existsSync(path.join(assetsDir, scene.clip));
  const clipPath = isClip ? path.join(assetsDir, scene.clip) : null;
  const stillPath = path.join(assetsDir, scene.screenshot);
  if (!stillPath || !existsSync(stillPath)) continue;

  let duration = 0;
  let zoom = 0;
  let win = null;
  let lastFrame = 0;
  if (isClip) {
    const src = probe(clipPath);
    if (src.w < src.h * 0.5) {
      console.warn(`  ${scene.id}: source is narrower than 9:16 (${src.w}x${src.h}) - skipped`);
      continue;
    }
    duration = src.duration;
    zoom = push && duration > 1 ? PUSH : 0;
    win = windowOf(src.w, src.h, measured.cropX);
    const frames = Math.max(2, Math.round(duration * FPS));
    lastFrame = frames - 1;
    const vf = [
      `crop=${win.cropW}:${win.cropH}:${win.cropX}:0`,
      `scale=${OUT_W}:${OUT_H}:flags=lanczos`,
      zoom ? PUSH_ZOOM(zoom, frames) : null,
      'setsar=1',
    ]
      .filter(Boolean)
      .join(',');
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', clipPath, '-vf', vf, '-an',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
        '-r', '30', '-movflags', '+faststart', path.join(outDir, `${scene.id}.mp4`)],
      {stdio: 'inherit'},
    );
  }

  // --- the still that follows the clip: the clip's own last frame, so the cut
  // does not jump in sharpness (the clip is 1x footage, the screenshot is 2x).
  // For a still scene it is the screenshot itself. Either way the window is
  // the one the push-in ends on, so the two line up. ---
  let stillSource = stillPath;
  if (isClip) {
    stillSource = path.join(outDir, `.${scene.id}-last.png`);
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', clipPath, '-vf', `select=eq(n\\,${lastFrame})`, '-frames:v', '1', stillSource],
      {stdio: 'inherit'},
    );
  }
  const stillSrc = probe(stillSource);
  const stillWin = windowOf(stillSrc.w, stillSrc.h, measured.cropX);
  const zf = 1 + zoom;
  const sw = even(stillWin.cropW / zf);
  const sh = even(stillWin.cropH / zf);
  const sx = Math.round(stillWin.cropX + (stillWin.cropW - sw) / 2);
  const sy = Math.round((stillWin.cropH - sh) / 2);
  const stillVf =
    `crop=${sw}:${sh}:${sx}:${sy},scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1`;
  const stillOut = path.join(outDir, `${scene.id}.png`);
  execFileSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-i', stillSource, '-vf', stillVf, '-frames:v', '1', stillOut],
    {stdio: 'inherit'},
  );
  if (isClip) rmSync(stillSource, {force: true});

  measured.asset = `vertical/${scene.id}.${isClip ? 'mp4' : 'png'}`;
  measured.still = `vertical/${scene.id}.png`;
  measured.isVideo = isClip;
  measured.push = zoom;
  measured.duration = duration;
  count++;
  console.log(
    `  ${scene.id.padEnd(24)} ${win ? `clip ${win.cropW}x${win.cropH}@${win.cropX}` : 'still'} -> ` +
      `${OUT_W}x${OUT_H}${zoom ? ` (push ${Math.round(zoom * 100)}%)` : ''}`,
  );
}

writeFileSync(vfPath, `${JSON.stringify(frames, null, 2)}\n`);
console.log(`vertical-crops: ${count} scenes cut -> ${outDir}`);
