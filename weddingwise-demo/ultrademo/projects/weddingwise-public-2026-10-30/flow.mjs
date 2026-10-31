// Ultrademo flow: WeddingWise - the public discovery experience.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// This project tours the unauthenticated surface: the landing page, the
// couple-facing planning page, the vendor marketplace and directory, a vendor
// public profile, and the two audience pages that explain what a vendor or a
// planner gets. Everything on camera is the real product with real seeded data.
//
// Most scenes are recorded clips, not stills: the pointer walks the real UI
// (typing in the marketplace search, paging through a gallery, opening the
// seating chart tools) so the footage reads as someone using the product.

import {OVERLAY_SCRIPT, goTo, hoverControls, idlePointer, scrollThrough} from '../../lib/ww.mjs';

export default {
  title: 'WeddingWise - the public experience',
  template: 'walkthrough',
  colorScheme: 'light',
  brand: '#e11d48',
  caption: {theme: 'outline', size: 'md', position: 'bottom'},
  inject: OVERLAY_SCRIPT,

  intro: {
    title: 'WeddingWise',
    subtitle: 'Wedding planning and marketplace for Greece',
    script:
      'Meet WeddingWise. The platform where couples, vendors, and planners plan a wedding from one shared place.',
  },

  scenes: [
    {
      id: 's1-home',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/', 3000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('a:visible:has-text("Plan your wedding")');
        await rec.pause(700);
        await scrollThrough(page, rec, {steps: 2, dy: 420});
        await hoverControls(page, rec, {count: 3, pause: 650});
        await scrollThrough(page, rec, {steps: 1, dy: -420});
        await idlePointer(page, rec, 2);
      },
      script:
        'Everything you need to plan your wedding in one place. Discover and compare photographers, venues, planners, and florists, while keeping your budget, checklist, guests, and inspiration together.',
    },

    {
      id: 's2-planning',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planning', 3000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('a:visible:has-text("Start planning free")');
        await rec.pause(700);
        await scrollThrough(page, rec, {steps: 2, dy: 400});
        await hoverControls(page, rec, {count: 3, pause: 650});
        await idlePointer(page, rec, 7);
      },
      script:
        'For couples, everything that lives in your head moves into one workspace. Checklist, budget, guests, seating, calendar, vendors, and your own wedding website. No spreadsheets, no scattered documents.',
    },

    {
      id: 's3-marketplace',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/vendors', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.type('#who-search-input', 'photography');
        await rec.pause(1400);
        await hoverControls(page, rec, {count: 2, pause: 700});
        await rec.scroll(300);
        await rec.pause(600);
      },
      script:
        'Discovery starts in the marketplace. Search by location, date, style, and budget, and every vendor you shortlist stays tied to your wedding.',
    },

    {
      id: 's4-vendor-profile',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/vendors/aegean-photography', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible[aria-label="Next image"]');
        await rec.pause(1100);
        await rec.click('button:visible[aria-label="Next image"]');
        await rec.pause(1100);
        await rec.click('button:visible:has-text("Gallery")');
        await rec.pause(1200);
        await rec.moveTo('button:visible:has-text("Request Booking")');
        await rec.pause(900);
      },
      script:
        'Every vendor gets a public profile with their work, pricing, reviews, and what they offer, so couples compare properly instead of guessing.',
    },

    {
      id: 's5-for-vendors',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/for-vendors', 3000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('a:visible:has-text("List your business")');
        await rec.pause(700);
        await scrollThrough(page, rec, {steps: 2, dy: 400});
        await hoverControls(page, rec, {count: 3, pause: 650});
        await idlePointer(page, rec, 6);
      },
      script:
        'Vendors get a business workspace of their own. Enquiries, booking requests, messages, availability, offers, and invoices all in one place, and you keep your leads.',
    },

    {
      id: 's6-for-planners',
      prepare: async (page) => {
        await goTo(page, '/for-planners', 3000);
      },
      settleMs: 1200,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
      script:
        'And planners run the whole business from a single CRM. Leads, client weddings, tasks, meetings, offers, and invoices, with a clear view of what needs attention today.',
    },

    {
      id: 's7-planners-directory',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planners', 3000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.type('#who-search-input', 'athens');
        await rec.pause(1200);
        await hoverControls(page, rec, {count: 2, pause: 700});
      },
      script:
        'Public directories for vendors and planners mean the right clients find you long before they reach out.',
    },
  ],

  outro: {
    title: 'WeddingWise',
    subtitle: 'weddingwise.gr',
    url: 'weddingwise.gr',
    script:
      'One platform, three sides of the wedding. Start planning free at weddingwise.gr.',
  },
};
