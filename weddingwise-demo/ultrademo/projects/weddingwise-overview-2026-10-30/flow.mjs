// Ultrademo flow: WeddingWise - platform overview.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// One video across all three sides of the marketplace: the public landing page
// and marketplace, then the couple workspace, the vendor workspace, and the
// planner workspace. The flow switches demo identity between segments so a
// single take can show the whole ecosystem.
//
// Every scene is a recorded clip: the pointer works through the real UI of
// each side (searching the marketplace, opening the couple dashboard, moving
// a vendor through the lead pipeline, walking the planner CRM), so the reel
// reads as the product being used rather than as a stack of screenshots.

import {
  OVERLAY_SCRIPT,
  WEDDING_ID,
  goTo,
  hoverControls,
  idlePointer,
  scrollThrough,
  signIn,
  switchRole,
} from '../../lib/ww.mjs';

export default {
  title: 'WeddingWise - the wedding platform for Greece',
  template: 'walkthrough',
  colorScheme: 'light',
  brand: '#e11d48',
  caption: {theme: 'outline', size: 'md', position: 'bottom'},
  inject: OVERLAY_SCRIPT,

  intro: {
    title: 'WeddingWise',
    subtitle: 'Where couples, vendors, and planners meet',
    script:
      'WeddingWise is the platform where the three sides of a wedding finally work from the same place.',
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
      },
      script:
        'For couples, everything you need to plan a wedding in one place. For vendors and planners, a real business workspace, not a contact form.',
    },

    {
      id: 's2-marketplace',
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
        await rec.pause(500);
      },
      script:
        'The marketplace is where it starts. Filter thousands of wedding vendors across Greece by location, date, style, and budget.',
    },

    {
      id: 's3-couple',
      media: 'clip',
      prepare: async (page) => {
        // The first two scenes are the public surface, so the flow starts
        // signed out and signs in here for the couple workspace.
        await signIn(page, 'couple');
        await goTo(page, `/my-wedding/${WEDDING_ID}`, 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        for (const label of ['Guest List', 'Seating Chart', 'Checklist', 'Budget Tracker']) {
          await rec.moveTo(`a:visible:has-text("${label}")`);
          await rec.pause(650);
        }
        await rec.scroll(360);
        await rec.pause(800);
        await idlePointer(page, rec, 1);
      },
      script:
        'A couple gets one workspace for the whole wedding: checklist, budget, guests, seating, timeline, and every vendor conversation.',
    },

    {
      id: 's4-vendor',
      media: 'clip',
      prepare: async (page) => {
        await switchRole(page, 'vendor');
        await goTo(page, '/vendor/leads', 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('button:visible:has-text("booked (1)")');
        await rec.pause(600);
        await rec.click('button:visible:has-text("booked (1)")');
        await rec.pause(1500);
        await hoverControls(page, rec, {count: 3, pause: 700, left: 300});
      },
      script:
        'A vendor gets a pipeline instead of a pile of enquiries. Every lead has a stage, and every booked wedding becomes a client workspace.',
    },

    {
      id: 's5-planner',
      media: 'clip',
      prepare: async (page) => {
        await switchRole(page, 'planner');
        await goTo(page, '/planner', 4500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await hoverControls(page, rec, {count: 3, pause: 700, left: 300});
        await rec.scroll(300);
        await rec.pause(600);
        await hoverControls(page, rec, {count: 1, pause: 700, left: 300});
      },
      script:
        'And a planner gets the whole business in one CRM: leads, client weddings, tasks, meetings, offers, and invoices.',
    },

    {
      id: 's6-for-vendors',
      prepare: async (page) => {
        await goTo(page, '/for-vendors', 3000);
      },
      settleMs: 1200,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
      script:
        'Listing is free, and you keep your leads. Claim an existing listing in minutes, or start a new one.',
    },

    {
      id: 's7-for-planners',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/for-planners', 3000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('a:visible:has-text("Create your planner profile")');
        await rec.pause(700);
        await scrollThrough(page, rec, {steps: 2, dy: 400});
        await hoverControls(page, rec, {count: 3, pause: 650});
      },
      script:
        'Planners get the same thing: one place for the couples, the work, and the money.',
    },
  ],

  outro: {
    title: 'WeddingWise',
    subtitle: 'weddingwise.gr',
    url: 'weddingwise.gr',
    script:
      'One platform, three sides of the wedding. Start free at weddingwise.gr.',
  },
};
