// Measure the real page geometry for the pages we film: how tall the page is
// when scrolled out, and how wide the app's content column actually is.
// This decides whether a 9:16 vertical can show a coherent view.
//
// Usage: node scout/geometry.mjs <role> <path> [...]
import {chromium} from 'playwright';
import {signIn, OVERLAY_SCRIPT, FRONTEND} from '../ultrademo/lib/ww.mjs';

const [role, ...paths] = process.argv.slice(2);
if (!role || !paths.length) {
  console.error('Usage: node scout/geometry.mjs <role> <path> [...]');
  process.exit(1);
}

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
await context.addInitScript({content: OVERLAY_SCRIPT});
const page = await context.newPage();
if (role !== 'public') await signIn(page, role);

for (const p of paths) {
  await page.goto(`${FRONTEND}${p}`, {waitUntil: 'load', timeout: 60_000});
  await page.waitForTimeout(3500);
  const g = await page.evaluate(() => {
    // widest element that holds most of the page's text/controls = the app shell
    const candidates = [...document.querySelectorAll('div, main, section, aside, header, nav')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {el, r};
      })
      .filter(({r}) => r.width > 200 && r.height > 200 && r.top < 900);
    // pick the container whose text density is highest (the real content column)
    let best = null;
    for (const {el, r} of candidates) {
      const txt = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (txt.length < 40) continue;
      const area = r.width * r.height;
      const density = txt.length / area;
      if (!best || density > best.density) best = {density, r, txt};
    }
    // sidebars / rails
    const rails = [...document.querySelectorAll('aside, nav, header')]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()} x=${Math.round(r.x)} w=${Math.round(r.width)}`;
      })
      .slice(0, 6);
    return {
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      bodyWidth: document.body.scrollWidth,
      content: best ? {x: Math.round(best.r.x), w: Math.round(best.r.width)} : null,
      rails,
    };
  });
  const aspect = (g.scrollHeight / g.bodyWidth).toFixed(2);
  console.log(
    `${role} ${p}\n   page ${g.bodyWidth}x${g.scrollHeight} (aspect ${aspect}) ` +
      `viewport 1080 of ${g.scrollHeight} = ${Math.round((1080 / g.scrollHeight) * 100)}% visible`,
  );
  console.log(`   content column: x=${g.content?.x} w=${g.content?.w}`);
  console.log(`   rails: ${g.rails.join(' | ')}`);
}

await browser.close();
