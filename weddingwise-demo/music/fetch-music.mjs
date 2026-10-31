#!/usr/bin/env node
// Download the public-domain ragtime beds listed in manifest.json.
//
//   node fetch-music.mjs
//
// Idempotent: a track that is already present and non-empty is left alone.
// The sources are Wikimedia Commons originals, so the download is stable.
import {createWriteStream, existsSync, mkdirSync, statSync} from 'node:fs';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'src');
const UA = 'WeddingWiseDemoPipeline/1.0 (local tooling)';

const manifest = JSON.parse(
  await import('node:fs/promises').then((fs) => fs.readFile(join(HERE, 'manifest.json'), 'utf8')),
);

mkdirSync(SRC, {recursive: true});

for (const track of manifest.tracks) {
  const dest = join(SRC, track.file);
  if (existsSync(dest) && statSync(dest).size > 100_000) {
    console.log(`have    ${track.file}`);
    continue;
  }
  console.log(`fetch   ${track.file}  <- ${track.title}`);
  const res = await fetch(track.source, {headers: {'User-Agent': UA}});
  if (!res.ok) throw new Error(`${track.file}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

console.log('\nall beds present in', SRC);
