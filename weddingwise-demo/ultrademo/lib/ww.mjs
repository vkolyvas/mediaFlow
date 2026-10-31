// Shared helpers for the WeddingWise demo flows.
//
// Auth: the app is better-auth based and its UI sign-in form is flaky against
// a cold dev server, so we sign in through the same API the e2e harness uses
// (auth-weddingwise/tests/e2e/screenshot-auth*.js). The session cookie lands
// in the browser context's cookie jar, so every later page.goto is
// authenticated.
//
// Overlays: the app renders a cookie-consent bar, an unverified-email warning
// and a "setup guide" widget. They are chrome, not product, and they sit on
// top of the content we want to show - so they get removed before a frame is
// ever captured.

export const FRONTEND = process.env.FRONTEND_ORIGIN || 'http://localhost:4000';
export const BACKEND = process.env.BACKEND_ORIGIN || 'http://localhost:9000';

export const ROLE_EMAIL = {
  couple: 'demo@weddingwise.test',
  vendor: 'demo-vendor@weddingwise.test',
  planner: 'demo-planner@weddingwise.test',
};
export const ROLE_PASSWORD = 'DemoPass!2026';

async function csrfToken(page) {
  const res = await page.request.get(`${BACKEND}/api/auth/csrf`, {
    headers: {Origin: FRONTEND},
  });
  if (!res.ok()) throw new Error(`csrf failed: ${res.status()}`);
  const setCookie = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie');
  const csrf = /csrf_token=([^;]+)/.exec(setCookie?.value || '')?.[1];
  if (!csrf) throw new Error('no csrf_token cookie in csrf response');
  return csrf;
}

// The seeded demo wedding (Maria & Giannis) - the couple workspace we tour.
export const WEDDING_ID = '11111111-1111-1111-1111-111111111111';
// The planner's client wedding (Elena & Markos).
export const PLANNER_WEDDING_ID = 'cdcdcdcd-cdcd-cdcd-cdcd-000000000001';
// A seeded couple<->vendor conversation (the /messages inbox is per-conversation).
export const CONVERSATION_ID = '77777777-7777-7777-7777-000000000001';

export async function signIn(page, role) {
  const email = ROLE_EMAIL[role];
  if (!email) throw new Error(`unknown role: ${role}`);

  const csrf = await csrfToken(page);

  const res = await page.request.post(`${BACKEND}/api/auth/sign-in/email`, {
    headers: {
      'content-type': 'application/json',
      origin: FRONTEND,
      'x-csrf-token': csrf,
      cookie: `csrf_token=${csrf}`,
    },
    data: {email, password: ROLE_PASSWORD},
  });
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()} ${(await res.text()).slice(0, 200)}`);

  const user = (await res.json()).user;
  console.log(`  signed in as ${user.email} (role=${user.role})`);
  return user;
}

// Drop the current session so another role can be signed in (used by the
// overview flow, which tours all three sides in one video).
export async function signOut(page) {
  const csrf = await csrfToken(page);
  const res = await page.request.post(`${BACKEND}/api/auth/sign-out`, {
    headers: {
      'content-type': 'application/json',
      origin: FRONTEND,
      'x-csrf-token': csrf,
      cookie: `csrf_token=${csrf}`,
    },
  });
  console.log(`  signed out (${res.status()})`);
}

export async function switchRole(page, role) {
  await signOut(page);
  return signIn(page, role);
}

// Injected into every page (before the app's own scripts) to strip the
// non-product chrome: cookie consent bar, unverified-email banner and the
// setup-guide widget. It only removes UI, it never changes app data.
export const OVERLAY_SCRIPT = `(() => {
  const kill = (el) => { if (el) el.style.setProperty('display', 'none', 'important'); };
  const sweep = () => {
    // cookie consent bar
    for (const b of document.querySelectorAll('button')) {
      if (/reject non-essential/i.test(b.innerText || '')) kill(b.closest('div.fixed'));
    }
    // setup-guide widget (couple / vendor / planner onboarding card)
    for (const el of document.querySelectorAll('div.fixed')) {
      const c = (el.className || '').toString();
      if (/top-\\d+/.test(c) && /right-/.test(c) && /w-\\d+/.test(c)) kill(el);
    }
    // unverified-email warning banner
    for (const p of document.querySelectorAll('p,span,div')) {
      if (p.children.length) continue;
      if (/verify your email address/i.test(p.textContent || '')) {
        kill(p.closest('div.max-w-7xl'));
        break;
      }
    }
  };
  const start = () => {
    sweep();
    new MutationObserver(sweep).observe(document.documentElement, {childList: true, subtree: true});
    setInterval(sweep, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();`;

// Navigate and wait for the app to actually render its data (the dashboards
// fetch their payload client-side, so "load" alone is too early).
export async function goTo(page, url, settleMs = 2500) {
  await page.goto(url.startsWith('http') ? url : `${FRONTEND}${url}`, {
    waitUntil: 'load',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', {timeout: 20_000}).catch(() => {});
  await page.waitForTimeout(settleMs);
}

// Walk the pointer through the visible controls of a page. A recorded clip
// where the mouse never moves reads as a slideshow; hovering the real UI
// (cards, list rows, chart segments) reads as someone using the product.
//
// The picks are spread across the viewport instead of taken from the top of
// the DOM, so the pointer travels instead of hopping between neighbours.
export async function hoverControls(page, rec, opts = {}) {
  const {
    selector = 'a, button, [role="button"]',
    count = 4,
    pause = 700,
    top = 90,
    bottom = 1000,
    left = 8,
    right = 1912,
    minWidth = 28,
  } = opts;
  const pts = await page.evaluate(
    ({selector, count, top, bottom, left, right, minWidth}) => {
      const out = [];
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none' || st.opacity === '0') continue;
        if (r.width < minWidth || r.height < 10) continue;
        if (r.top < top || r.bottom > bottom || r.left < left || r.right > right) continue;
        out.push({x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)});
      }
      if (out.length <= count) return out;
      if (count === 1) return [out[Math.floor((out.length - 1) / 2)]];
      const picked = [];
      for (let i = 0; i < count; i++) {
        picked.push(out[Math.round((i * (out.length - 1)) / (count - 1))]);
      }
      return picked;
    },
    {selector, count, top, bottom, left, right, minWidth},
  );
  for (const p of pts) {
    await rec.hoverPoint(p);
    await rec.pause(pause);
  }
  return pts.length;
}

// Scroll down in steps, letting the page settle between them.
export async function scrollThrough(page, rec, {steps = 2, dy = 380, pause = 500} = {}) {
  for (let i = 0; i < steps; i++) {
    await rec.scroll(dy);
    await rec.pause(pause);
  }
}

// Keep the pointer alive for a few seconds: small drifts around where it
// already is. A clip shorter than its narration would otherwise freeze on
// the last frame for the rest of the scene.
export async function idlePointer(page, rec, seconds = 4) {
  const base = rec.position();
  const steps = Math.max(1, Math.round(seconds / 1.3));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    await rec.hoverPoint({
      x: Math.round(base.x + Math.cos(a) * 80),
      y: Math.round(base.y + Math.sin(a) * 55),
    });
    await rec.pause(700);
  }
}
