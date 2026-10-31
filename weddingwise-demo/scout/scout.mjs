// Scout the real WeddingWise app: sign in via the better-auth API (same
// pattern as auth-weddingwise/tests/e2e/screenshot-auth*.js), then visit each
// candidate route and report what actually rendered.
//
// Usage: node scout.mjs <role:public|couple|vendor|planner> <url> [url...]

import {chromium} from 'playwright';

const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:4000';
const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:9000';

const CREDS = {
  couple: ['demo@weddingwise.test', 'DemoPass!2026'],
  vendor: ['demo-vendor@weddingwise.test', 'DemoPass!2026'],
  planner: ['demo-planner@weddingwise.test', 'DemoPass!2026'],
};

async function signIn(context, role) {
  const [email, password] = CREDS[role];
  const csrfRes = await context.request.get(`${BACKEND}/api/auth/csrf`, {
    headers: {Origin: FRONTEND},
  });
  if (!csrfRes.ok) throw new Error(`csrf ${csrfRes.status()}`);
  const setCookie = csrfRes.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie');
  const csrf = /csrf_token=([^;]+)/.exec(setCookie?.value || '')?.[1];
  if (!csrf) throw new Error('no csrf_token cookie');

  const res = await context.request.post(`${BACKEND}/api/auth/sign-in/email`, {
    headers: {
      'content-type': 'application/json',
      origin: FRONTEND,
      'x-csrf-token': csrf,
      cookie: `csrf_token=${csrf}`,
    },
    data: {email, password},
  });
  if (!res.ok) throw new Error(`signin ${res.status()} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).user;
}

const [, , role, ...urls] = process.argv;
const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}});

if (CREDS[role]) {
  const user = await signIn(context, role);
  console.log(`# signed in as ${user.email} (role=${user.role})\n`);
}

for (const url of urls) {
  const full = url.startsWith('http') ? url : `${FRONTEND}${url}`;
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  try {
    const resp = await page.goto(full, {waitUntil: 'load', timeout: 60_000});
    await page.waitForLoadState('networkidle', {timeout: 20_000}).catch(() => {});
    // dismiss the cookie consent layer so it never overlaps a shot
    await page
      .getByRole('button', {name: /reject non-essential/i})
      .first()
      .click({timeout: 3000})
      .catch(() => {});
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      const uniq = (arr) => [...new Set(arr)];
      const links = uniq(
        [...document.querySelectorAll('a[href]')]
          .filter(vis)
          .map((a) => `${txt(a).slice(0, 40)} | ${a.getAttribute('href')}`)
          .filter((s) => s !== ' |')
      ).slice(0, 60);
      const buttons = uniq(
        [...document.querySelectorAll('button,[role=button]')].filter(vis).map(txt)
      )
        .filter(Boolean)
        .slice(0, 40);
      const inputs = [...document.querySelectorAll('input,textarea,select')]
        .filter(vis)
        .map((i) => `${i.tagName.toLowerCase()}[name=${i.name || '-'}] type=${i.type || '-'}`);
      return {
        title: document.title,
        h1: uniq([...document.querySelectorAll('h1')].map(txt)).slice(0, 3),
        h2: uniq([...document.querySelectorAll('h2,h3')].map(txt)).filter(Boolean).slice(0, 14),
        links,
        buttons,
        inputs: uniq(inputs).slice(0, 12),
        bodyLen: document.body.innerText.replace(/\s+/g, ' ').trim().length,
        head: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 400),
      };
    });
    console.log(`\n=== ${full}`);
    console.log(`status=${resp?.status()} finalUrl=${page.url()} title="${info.title}" bodyLen=${info.bodyLen}`);
    console.log(`h1: ${JSON.stringify(info.h1)}`);
    console.log(`h2/h3: ${JSON.stringify(info.h2)}`);
    console.log(`inputs: ${JSON.stringify(info.inputs)}`);
    console.log(`buttons: ${JSON.stringify(info.buttons)}`);
    console.log(`links:\n  ${info.links.join('\n  ')}`);
    console.log(`head: ${info.head}`);
    if (errors.length) console.log(`JS ERRORS: ${errors.join(' | ')}`);
  } catch (e) {
    console.log(`\n=== ${full}\nFAILED: ${String(e).split('\n')[0]}`);
  }
  await page.close();
}

await browser.close();
