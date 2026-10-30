#!/usr/bin/env node
// Mix a very low ragtime bed under the narration of the rendered videos.
//
//   node mix.mjs [project ...]
//
// Each project gets its own piece (see manifest.json). The bed is loudness
// normalised, faded in/out and then ducked under the speech with ffmpeg's
// sidechain compressor, so the rag only surfaces in the gaps between lines.
//
// The narration is already the video's own audio track, so the mix is a
// post-process on the finished MP4: video is copied, audio is re-encoded.
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(HERE, '..', 'ultrademo');
const SRC = join(HERE, 'src');

const manifest = JSON.parse(
  await import('node:fs/promises').then((fs) => fs.readFile(join(HERE, 'manifest.json'), 'utf8')),
);
const d = manifest.defaults;

const probe = (file, args) =>
  execFileSync('ffprobe', ['-v', 'error', ...args, '-of', 'default=nw=1:nk=1', file], {
    encoding: 'utf8',
  }).trim();

const durationOf = (file) => Number(probe(file, ['-show_entries', 'format=duration']));

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

const archive = (file, outDir) => {
  const dir = join(outDir, 'archive');
  mkdirSync(dir, {recursive: true});
  const base = file.split('/').pop();
  renameSync(file, join(dir, `${stamp()}-${base}`));
};

const mix = (video, bed, out) => {
  const dur = durationOf(video);
  const fadeOut = Math.min(d.fadeOutSec, Math.max(0.5, dur - 0.5));
  const fadeOutAt = (dur - fadeOut).toFixed(3);

  const filter = [
    // the bed: stereo 48k, trimmed to the video length, normalised, faded
    `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
      `atrim=0:${dur.toFixed(3)},asetpts=N/SR/TB,` +
      `loudnorm=I=${d.targetLufs}:TP=-2:LRA=11,` +
      `afade=t=in:st=0:d=${d.fadeInSec},` +
      `afade=t=out:st=${fadeOutAt}:d=${fadeOut.toFixed(3)},` +
      `volume=${d.bedGainDb}dB[bed];`,
    // the narration becomes the sidechain that pushes the bed down
    `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,asplit=2[main][sc];`,
    `[bed][sc]sidechaincompress=threshold=${d.duckThreshold}:ratio=${d.duckRatio}:` +
      `attack=${d.duckAttackMs}:release=${d.duckReleaseMs}[duck];`,
    `[main][duck]amix=inputs=2:normalize=0:duration=first[out]`,
  ].join('');

  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', video,
    '-i', bed,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[out]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    out,
  ]);
};

// the processed bed on its own, so an editor can remix it against the stems
const renderBed = (bed, dur, out) => {
  const fadeOut = Math.min(d.fadeOutSec, Math.max(0.5, dur - 0.5));
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', bed,
    '-af', `aformat=channel_layouts=stereo,atrim=0:${dur.toFixed(3)},asetpts=N/SR/TB,` +
      `loudnorm=I=${d.targetLufs}:TP=-2:LRA=11,` +
      `afade=t=in:st=0:d=${d.fadeInSec},afade=t=out:st=${(dur - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)},` +
      `volume=${d.bedGainDb}dB`,
    '-c:a', 'libmp3lame', '-b:a', '192k', out,
  ]);
};

const requested = process.argv.slice(2);
const projects = requested.length
  ? requested
  : Object.keys(manifest.projects);

for (const project of projects) {
  const trackId = manifest.projects[project];
  const track = manifest.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`${project}: no track "${trackId}" in the manifest`);

  const bed = join(SRC, track.file);
  if (!existsSync(bed)) throw new Error(`${project}: missing bed ${bed} - run fetch-music.mjs`);

  const outDir = join(WORKSPACE, 'projects', project, 'out');
  if (!existsSync(outDir)) {
    console.log(`skip    ${project} (no out/ - render it first)`);
    continue;
  }

  const variants = readdirSync(outDir).filter(
    (f) => f.endsWith('.mp4') && !f.endsWith('.music.mp4'),
  );

  // The bed is mixed into the video's own audio, so mixing a file twice would
  // stack two beds. The marker records what has already been mixed; the render
  // step clears an entry when it produces a fresh file.
  const markerPath = join(outDir, '.mixed.json');
  const marker = existsSync(markerPath) ? JSON.parse(readFileSync(markerPath, 'utf8')) : {};

  for (const name of variants) {
    if (marker[name] === track.id) {
      console.log(`skip    ${name} (already mixed - re-render to change the bed)`);
      continue;
    }
    const video = join(outDir, name);
    const tmp = `${video}.music.mp4`;
    mix(video, bed, tmp);
    archive(video, outDir);
    renameSync(tmp, video);
    marker[name] = track.id;
    console.log(
      `mixed   ${track.title} (${track.artist}) -> ${name}  ` +
      `bed ${d.bedGainDb}dB, ducked ${d.duckRatio}:1`,
    );
  }
  writeFileSync(markerPath, JSON.stringify(marker, null, 2));

  // standalone bed, aligned to the video length, for the stems bundle
  const stem = join(outDir, 'music.mp3');
  if (existsSync(stem)) continue;
  const main = join(outDir, `${project}.mp4`);
  if (!existsSync(main)) continue;
  renderBed(bed, durationOf(main), stem);
  console.log(`bed     ${stem}`);
}
