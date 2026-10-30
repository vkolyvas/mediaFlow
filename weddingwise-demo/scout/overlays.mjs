// Probe overlay/banner DOM so the flow can dismiss them deterministically.
import {chromium} from 'playwright';

const FRONTEND = 'http://localhost:4000';
const BACKEND = 'http://localhost:9000';

const browser = await chromium.launch({headless: true});
const context = await browser.newContext({viewport: {width: 1920, height: 1080}});

// csrf + sign-in as couple
const csrfRes = await context.request.get(`${BACKEND}/api/auth/csrf`, {headers: {Origin: FRONTEND}});
const setCookie = csrfRes.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie');
const csrf = /csrf_token=([^;]+)/.exec(setCookie.value)[1];
await context.request.post(`${BACKEND}/api/auth/sign-in/email`, {
  headers: {'content-type': 'application/json', origin: FRONTEND, 'x-csrf-token': csrf, cookie: `csrf_token=${csrf}`},
  data: {email: 'demo@weddingwise.test', password: 'DemoPass!2026'},
});

const page = await context.newPage();
await page.goto(`${FRONTEND}/my-wedding/11111111-1111-1111-1111-111111111111`, {waitUntil: 'load'});
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const desc = (el) => ({
    tag: el.tagName,
    id: el.id,
    cls: (el.className || '').toString().slice(0, 120),
    text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    parentCls: (el.parentElement?.className || '').toString().slice(0, 120),
  });
  const res = {};
  res.cookieBtn = [...document.querySelectorAll('button')].filter((b) => /reject non-essential|accept all/i.test(b.innerText)).map(desc);
  res.cookieContainers = [...document.querySelectorAll('button')]
    .filter((b) => /reject non-essential/i.test(b.innerText))
    .map((b) => {
      let n = b;
      const chain = [];
      for (let i = 0; i < 5 && n; i++) {
        chain.push(`${n.tagName}.${(n.className || '').toString().slice(0, 60)}`);
        n = n.parentElement;
      }
      return chain;
    });
  res.verifyBanner = [...document.querySelectorAll('*')]
    .filter((e) => e.children.length === 0 && /verify your email/i.test(e.textContent || ''))
    .map((e) => {
      let n = e;
      const chain = [];
      for (let i = 0; i < 4 && n; i++) {
        chain.push(`${n.tagName}.${(n.className || '').toString().slice(0, 60)}`);
        n = n.parentElement;
      }
      return chain;
    });
  res.onboarding = [...document.querySelectorAll('*')]
    .filter((e) => e.children.length === 0 && /plan your wedding|build your|shape/i.test(e.textContent || ''))
    .slice(0, 4)
    .map((e) => {
      let n = e;
      const chain = [];
      for (let i = 0; i < 5 && n; i++) {
        chain.push(`${n.tagName}.${(n.className || '').toString().slice(0, 70)}`);
        n = n.parentElement;
      }
      return chain;
    });
  res.closeBtns = [...document.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === '✕' || b.getAttribute('aria-label')?.toLowerCase().includes('close')).map(desc);
  res.localStorage = Object.keys(localStorage);
  return res;
});
console.log(JSON.stringify(out, null, 2));
await browser.close();
