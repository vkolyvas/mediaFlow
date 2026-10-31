// Render helper: picks the composition, flags, and output name for a project.
//
// Usage: npm run render -- <project> [--vertical] [--portrait] [--square] [--instagram]
//                                    [--gif] [--no-captions] [--stems]
//                                    [--caption-theme=outline|pill|bar] [--caption-size=sm|md|lg]
//                                    [--caption-position=bottom|top] [--caption-highlight=dim|pill|wipe]
//                                    [--caption-literal-color=#hex]
//
// Default output is the FINALIZED video (captions burned in, narration mixed).
// Caption look is set per-storyboard (storyboard.caption); the --caption-* flags
// override it for a single render so you can try styles without re-capturing.
// Aspect-ratio variants (one capture, every format):
//   --vertical   1080x1920  9:16 reel, full runtime
//   --portrait  1080x1350  4:5 Instagram feed, cut to the feed length limit
//   --square    1080x1080  1:1 Instagram feed, cut to the feed length limit
//   --instagram             all three of the above
//
// Power-user opt-ins for editing before publishing:
//   --no-captions  finalized video without burned-in captions
//   --stems        editor-ready bundle in out/<project>-stems/:
//                    video.mp4      clean video track (no captions, no audio)
//                    narration.mp3  timeline-aligned narration track
//                    captions.srt   subtitles matching the same timeline
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'node:fs';

const args = process.argv.slice(2);
const project = args.find((a) => !a.startsWith('--'));
if (!project) {
  console.error('Usage: npm run render -- <project> [--vertical] [--portrait] [--square] [--instagram] [--gif] [--no-captions] [--stems] [--caption-theme=] [--caption-size=] [--caption-position=]');
  process.exit(1);
}
const gif = args.includes('--gif');
const noCaptions = args.includes('--no-captions');
const stems = args.includes('--stems');
const flagVal = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : undefined;
};
const captionOverride = {
  theme: flagVal('caption-theme'),
  size: flagVal('caption-size'),
  position: flagVal('caption-position'),
  highlight: flagVal('caption-highlight'), // dim|pill|wipe (ElevenLabs voices only)
  literalColor: flagVal('caption-literal-color'), // tint for double-quoted UI literals (default sky #7dd3fc)
};
const caption = Object.fromEntries(Object.entries(captionOverride).filter(([, v]) => v));

// Aspect-ratio variants. --instagram renders all three.
const VARIANTS = {vertical: 'DemoVertical', portrait: 'DemoPortrait', square: 'DemoSquare'};
const wanted = args.includes('--instagram')
  ? ['vertical', 'portrait', 'square']
  : ['vertical', 'portrait', 'square'].filter((v) => args.includes(`--${v}`));

const comp = wanted.length ? VARIANTS[wanted[0]] : 'Demo';
const publicDir = `projects/${project}/assets`;
const outDir = `projects/${project}/out`;

// Mirror of the renderer's timing math (Demo.tsx) - keep in sync.
const HOLD_AFTER_AUDIO = 0.7;
const HOLD_AFTER_CLIP = 0.4;
const SLIDE_SECONDS = 3; // minimum intro/outro title-card duration (Demo.tsx)
const SLIDE_LEAD_IN = 0.75; // narrated slides: audio starts this long after the card appears
const FPS = 30;
const slideSeconds = (slide) => {
  if (!slide) return 0;
  if (!slide.audioDuration) return SLIDE_SECONDS;
  return Math.max(Math.round(SLIDE_SECONDS * FPS), Math.round((SLIDE_LEAD_IN + slide.audioDuration + HOLD_AFTER_AUDIO) * FPS)) / FPS;
};
const clipRate = (s) => {
  const narration = (s.audioDuration ?? s.durationHint ?? 4) + HOLD_AFTER_AUDIO;
  const clip = s.clipDuration ?? 0;
  if (!clip || clip <= narration) return 1;
  return Math.min(1.3, clip / narration);
};
const sceneSeconds = (s) => {
  const narration = (s.audioDuration ?? s.durationHint ?? 4) + HOLD_AFTER_AUDIO;
  const clip = s.clipDuration ? s.clipDuration / clipRate(s) + HOLD_AFTER_CLIP : 0;
  return Math.max(1, Math.round(Math.max(narration, clip) * FPS)) / FPS;
};

// Regen support: never overwrite a previous render - archive it first, so
// "the UI changed" always leaves a before/after pair to compare.
const archive = (out) => {
  if (!existsSync(out)) return;
  const stamp = statSync(out).mtime.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dir = `${outDir}/archive`;
  mkdirSync(dir, {recursive: true});
  const base = out.split('/').pop();
  renameSync(out, `${dir}/${stamp}-${base}`);
  console.log(`archived previous render -> ${dir}/${stamp}-${base}`);
};

const renderComp = (out, props, composition = comp) => {
  archive(out);
  execFileSync(
    'npx',
    ['remotion', 'render', 'render/src/index.ts', composition, out,
      `--public-dir=${publicDir}`,
      '--timeout=90000',
      `--props=${JSON.stringify(props)}`,
      ...(gif ? ['--codec=gif', '--every-nth-frame=2', '--scale=0.5'] : [])],
    {stdio: 'inherit'},
  );
  invalidateMix(out);
};

// The music bed is mixed into the rendered file as a post-process, so a fresh
// render invalidates the "already mixed" marker for that file (otherwise the
// next mix would stack a second bed on top of the first).
const invalidateMix = (out) => {
  const markerPath = `${outDir}/.mixed.json`;
  if (!existsSync(markerPath)) return;
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  const key = out.split('/').pop();
  if (!(key in marker)) return;
  delete marker[key];
  writeFileSync(markerPath, JSON.stringify(marker, null, 2));
};
mkdirSync(outDir, {recursive: true});

const captionProp = Object.keys(caption).length ? {caption} : {};

// Instagram's feed rejects videos longer than 60 s. The feed formats are cut
// down to a highlight reel instead of being chopped at a fixed timestamp: the
// intro and the outro (which carries the URL) always survive, and the scenes
// in between are spread evenly so the cut still reads as a story.
const FEED_LIMIT = 59.5;

const feedSceneIds = (sb) => {
  const intro = slideSeconds(sb.intro);
  const outro = slideSeconds(sb.outro);
  const budget = FEED_LIMIT - intro - outro;
  const costs = sb.scenes.map((s) => sceneSeconds(s));
  const total = costs.reduce((a, b) => a + b, 0);
  if (total <= budget) return null; // the full story already fits the feed
  const n = sb.scenes.length;
  const pick = (k) => {
    if (k <= 1) return [sb.scenes[Math.floor((n - 1) / 2)].id];
    const ids = [];
    for (let i = 0; i < k; i++) ids.push(sb.scenes[Math.round((i * (n - 1)) / (k - 1))].id);
    return [...new Set(ids)];
  };
  const cost = (ids) =>
    ids.reduce((sum, id) => sum + costs[sb.scenes.findIndex((s) => s.id === id)], 0);
  const ids = pick(Math.max(1, Math.floor(budget / (total / n))));
  while (ids.length > 1 && intro + outro + cost(ids) > FEED_LIMIT) ids.pop();
  return ids;
};

if (!stems) {
  if (!wanted.length) {
    const out = `${outDir}/${project}${noCaptions ? '-nocaptions' : ''}.${gif ? 'gif' : 'mp4'}`;
    renderComp(out, {storyboard: null, captions: !noCaptions, ...captionProp});
    console.log(`\nrendered ${out}`);
  } else {
    const sb = JSON.parse(readFileSync(`${publicDir}/storyboard.json`, 'utf8'));
    const feed = feedSceneIds(sb);
    for (const variant of wanted) {
      const out = `${outDir}/${project}-${variant}${noCaptions ? '-nocaptions' : ''}.mp4`;
      // The reel keeps the full runtime; the feed formats use the cut.
      const props = {
        storyboard: null,
        captions: !noCaptions,
        ...captionProp,
        ...(variant !== 'vertical' && feed ? {sceneIds: feed} : {}),
      };
      renderComp(out, props, VARIANTS[variant]);
      console.log(
        `\nrendered ${out}${feed && variant !== 'vertical' ? `  (feed cut: ${feed.length}/${sb.scenes.length} scenes kept)` : ''}`,
      );
    }
  }
} else {
  const dir = `${outDir}/stems`;
  mkdirSync(dir, {recursive: true});
  const sb = JSON.parse(readFileSync(`${publicDir}/storyboard.json`, 'utf8'));

  // the finalized video is ALWAYS produced, stems are additional
  const finalOut = `${outDir}/${project}.mp4`;
  renderComp(finalOut, {storyboard: null, ...captionProp});
  console.log(`rendered ${finalOut} (finalized)`);

  // scene start offsets on the final timeline; an intro slide pushes scene 1 back
  let t = slideSeconds(sb.intro);
  const starts = sb.scenes.map((s) => {
    const at = t;
    t += sceneSeconds(s);
    return at;
  });
  const outroStart = t;
  t += slideSeconds(sb.outro);

  // 1. clean video track
  renderComp(`${dir}/video.mp4`, {storyboard: null, captions: false, audio: false});

  // 2. timeline-aligned narration track (each clip delayed to its unit's start;
  //    narrated slides count too, offset by the slide lead-in)
  const withAudio = [
    ...(sb.intro?.audio ? [{s: sb.intro, at: SLIDE_LEAD_IN}] : []),
    ...sb.scenes.map((s, i) => ({s, at: starts[i]})).filter((x) => x.s.audio),
    ...(sb.outro?.audio ? [{s: sb.outro, at: outroStart + SLIDE_LEAD_IN}] : []),
  ];
  const inputs = withAudio.flatMap((x) => ['-i', `${publicDir}/${x.s.audio}`]);
  const delays = withAudio
    .map((x, i) => `[${i}]adelay=${Math.round(x.at * 1000)}:all=1[a${i}]`)
    .join(';');
  const mix = `${withAudio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${withAudio.length}:normalize=0[out]`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${delays};${mix}`,
    '-map', '[out]', '-t', String(t.toFixed(3)), `${dir}/narration.mp3`]);

  // 3. SRT matching the same timeline
  const ts = (sec) => {
    const ms = Math.round(sec * 1000);
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s2 = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s2},${String(ms % 1000).padStart(3, '0')}`;
  };
  const srtUnits = [
    ...(sb.intro?.script ? [{script: sb.intro.script, at: SLIDE_LEAD_IN, dur: sb.intro.audioDuration}] : []),
    ...sb.scenes.map((s, i) => ({script: s.script, at: starts[i], dur: s.audioDuration ?? s.durationHint ?? 4})),
    ...(sb.outro?.script ? [{script: sb.outro.script, at: outroStart + SLIDE_LEAD_IN, dur: sb.outro.audioDuration}] : []),
  ];
  const srt = srtUnits
    .map((u, i) => `${i + 1}\n${ts(u.at)} --> ${ts(u.at + (u.dur ?? 4))}\n${u.script}\n`)
    .join('\n');
  writeFileSync(`${dir}/captions.srt`, srt);

  console.log(`\nstems ready in ${dir}/: video.mp4 (clean), narration.mp3, captions.srt (finalized video also rendered)`);
}
