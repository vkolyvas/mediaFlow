import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  carouselSpecs,
  reelSpecs,
  usesGradient,
  readableUrl,
  escapeHtml,
  planPost,
  renderPost,
} from '../lib/render.mjs';

const carouselPost = {
  id: 'p_test_carousel',
  format: 'carousel',
  title: 'How to choose a wedding venue',
  cta: 'See the venues on WeddingWise',
  utmUrl: 'https://weddingwise.gr/vendors/category/wedding_venue?utm_source=instagram&utm_medium=social&utm_campaign=c_test',
  caption: 'A carousel about venues.',
  script: {
    hook: 'Choosing a venue is the first thing you book',
    altText: 'Three slides about choosing a wedding venue.',
    slides: [
      { headline: 'Start with a venue brief', body: 'Guest count, budget, season.' },
      { headline: 'Ask about the rain plan', body: 'Every venue has one.' },
      { headline: 'Pay the deposit last', body: 'After the contract is clear.' },
    ],
  },
};

const reelPost = {
  id: 'p_test_reel',
  format: 'reel',
  title: 'Planning a wedding in Santorini',
  cta: 'Find your venue on WeddingWise',
  utmUrl: 'https://weddingwise.gr/vendors/category/wedding_venue?utm_source=instagram&utm_medium=social&utm_campaign=c_test',
  caption: 'A reel about Santorini.',
  script: {
    hook: 'Planning a wedding in Santorini?',
    altText: 'A reel about Santorini venues.',
    shotList: [
      { onScreenText: 'The caldera does the decorating' },
      { onScreenText: 'Your guests get the whole place' },
    ],
  },
};

test('a carousel ends on a call to action', () => {
  const specs = carouselSpecs(carouselPost);
  assert.equal(specs.length, carouselPost.script.slides.length + 1);
  assert.equal(specs[specs.length - 1].kind, 'cta');
  assert.equal(specs[specs.length - 1].headline, carouselPost.cta);
});

test('the hook rides on the first slide instead of taking one', () => {
  const specs = carouselSpecs(carouselPost);
  assert.equal(specs[0].kicker, carouselPost.script.hook);
  assert.equal(specs[1].kicker, '');
  // The brand guidelines allow four to seven slides.
  assert.ok(specs.length >= 4 && specs.length <= 7, `${specs.length} slides`);
});

test('the tracking parameters are stripped from the link on the slide', () => {
  const specs = carouselSpecs(carouselPost);
  assert.equal(specs[specs.length - 1].body, 'weddingwise.gr/vendors/category/wedding_venue');
});

test('a reel is the hook, one frame per shot, and the call to action', () => {
  const specs = reelSpecs(reelPost);
  assert.equal(specs.length, reelPost.script.shotList.length + 2);
  assert.equal(specs[0].kind, 'hook');
  assert.equal(specs[specs.length - 1].kind, 'cta');
});

test('the gradient is decided by the post, not by the run', () => {
  const first = usesGradient(carouselPost);
  assert.equal(usesGradient(carouselPost), first);
  const posts = Array.from({ length: 50 }, (_, i) => ({ id: `p_${i}`, fingerprint: `f${i}` }));
  const withGradient = posts.filter(usesGradient).length;
  assert.ok(withGradient >= 5 && withGradient <= 15, `${withGradient} of 50`);
});

test('a url is shortened to what a reader needs', () => {
  assert.equal(
    readableUrl('https://weddingwise.gr/vendors/?utm_source=instagram&utm_medium=social'),
    'weddingwise.gr/vendors',
  );
  assert.equal(readableUrl(''), '');
});

test('markup in the copy cannot escape into the page', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('the plan names a file per slide, relative to the assets directory', () => {
  const plan = planPost(carouselPost, { assetsDir: '/tmp/assets' });
  assert.equal(plan.media.length, carouselPost.script.slides.length + 1);
  assert.equal(plan.media[0].path, path.join('rendered', 'p_test_carousel', 'carousel-1.png'));
  assert.equal(plan.dir, '/tmp/assets/rendered/p_test_carousel');
  assert.match(plan.media[0].alt, /slide 1 of 4/);
});

test('a carousel renders to one 4:5 png per slide', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-render-'));
  const { media } = await renderPost(carouselPost, { assetsDir: dir, force: true });
  try {
    assert.equal(media.length, 4);
    for (const item of media) {
      const file = path.join(dir, item.path);
      assert.ok(fs.existsSync(file), `${file} is missing`);
      const head = fs.readFileSync(file).subarray(0, 24);
      assert.equal(head.subarray(1, 4).toString('latin1'), 'PNG');
      // 1080 x 1350 is the 4:5 the guidelines ask for.
      assert.equal(head.readUInt32BE(16), 1080);
      assert.equal(head.readUInt32BE(20), 1350);
    }
    assert.ok(fs.existsSync(path.join(dir, 'rendered', 'p_test_carousel', 'caption.txt')));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
