// Ultrademo flow: WeddingWise - the planner business workspace.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// Signed in as the seeded demo planner (demo-planner@weddingwise.test, "Aegean
// Wedding Planners"). The tour covers the planner dashboard, the CRM inbox,
// the client wedding workspace, the offer pipeline and the meeting calendar -
// all populated by the demo seed.
//
// Most scenes are recorded clips: the pointer opens the CRM, works the sales
// stages, filters the client list, flips between offer tabs and the agency
// team view - the real workspace, on camera.

import {
  OVERLAY_SCRIPT,
  PLANNER_WEDDING_ID,
  goTo,
  hoverControls,
  idlePointer,
  signIn,
} from '../../lib/ww.mjs';

export default {
  title: 'WeddingWise - running your planning business',
  template: 'walkthrough',
  colorScheme: 'light',
  brand: '#e11d48',
  caption: {theme: 'outline', size: 'md', position: 'bottom'},
  inject: OVERLAY_SCRIPT,

  setup: async (page) => {
    await signIn(page, 'planner');
  },

  intro: {
    title: 'For planners',
    subtitle: 'Your whole business, one CRM',
    script:
      'A wedding planner is running a business, not just a wedding. WeddingWise gives that business one place to live.',
  },

  scenes: [
    {
      id: 's1-dashboard',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner', 4500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await hoverControls(page, rec, {count: 4, pause: 700, left: 300});
        await rec.scroll(320);
        await rec.pause(900);
      },
      script:
        'The dashboard opens on what actually needs attention: open leads, today tasks, today meetings, and the offers still waiting on an answer.',
    },

    {
      id: 's2-inbox',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner', 4500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('a[href="/planner/inbox"]');
        await rec.pause(400);
        await rec.click('a[href="/planner/inbox"]');
        await rec.pause(2600);
      },
      script:
        'The CRM is where every couple relationship starts. Track inquiries, qualify them, and turn the right ones into a signed wedding.',
    },

    {
      id: 's2b-consultations',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/consultations', 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.type('input:visible[type="search"]', 'elena');
        await rec.pause(1700);
        await rec.moveTo('button:visible:has-text("Awaiting offer")');
        await rec.pause(800);
        await hoverControls(page, rec, {count: 2, pause: 700, left: 300});
      },
      script:
        'The sales workspace takes a couple from first contact to a signed booking, with the consultation notes and the next step always in view.',
    },

    {
      id: 's3-weddings',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/weddings', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("Agency")');
        await rec.pause(1500);
        await hoverControls(page, rec, {count: 3, pause: 700, left: 300});
      },
      script:
        'Every client wedding is listed with its couple, date, and stage, whether it is personal or run through your agency.',
    },

    {
      id: 's4-workspace',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `/planner/weddings/${PLANNER_WEDDING_ID}/plan`, 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('button:visible:has-text("Vendors")');
        await rec.pause(700);
        await rec.moveTo('button:visible:has-text("Inquiry")');
        await rec.pause(700);
        await hoverControls(page, rec, {count: 2, pause: 700, left: 300});
      },
      script:
        'Inside a wedding you get the timeline, the checklist, the people, your team, and the seating chart, all against that one couple.',
    },

    {
      id: 's5-offers',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/offers', 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('button:visible:has-text("Refresh")');
        await rec.pause(400);
        await rec.click('button:visible:has-text("Refresh")');
        await rec.pause(1800);
        await rec.click('a:visible:has-text("Contracts")');
        await rec.pause(1400);
        await rec.click('a:visible:has-text("Invoices")');
        await rec.pause(1400);
        await idlePointer(page, rec, 1);
      },
      script:
        'Offers, contracts, and invoices share one pipeline. You can see what a couple is waiting on, what it is worth, and how long it has been sitting there.',
    },

    {
      id: 's5b-agency',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/agency', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("Team")');
        await rec.pause(1400);
        await rec.click('button:visible:has-text("Operations")');
        await rec.pause(1400);
        await hoverControls(page, rec, {count: 2, pause: 700, left: 300});
      },
      script:
        'Working as an agency? The same workspace carries your team and your client list, so nothing lives in one person s head.',
    },

    {
      id: 's5c-profile',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/profile', 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('input:visible[placeholder*="Olive"]');
        await rec.pause(700);
        await rec.moveTo('textarea:visible');
        await rec.pause(700);
        await rec.moveTo('select:visible');
        await rec.pause(800);
        await idlePointer(page, rec, 2);
      },
      script:
        'Your public planner profile is the page couples find you on, with your bio, your portfolio, and your specialities.',
    },

    {
      id: 's6-meetings',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/planner/meetings', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("scheduled")');
        await rec.pause(1500);
        await hoverControls(page, rec, {count: 3, pause: 700, left: 300});
      },
      script:
        'Consultations and meetings across every wedding and lead, scheduled and tracked in one calendar.',
    },
  ],

  outro: {
    title: 'Start as a planner',
    subtitle: 'weddingwise.gr',
    url: 'weddingwise.gr',
    script:
      'One CRM for the couples, the work, and the money. Start as a planner at weddingwise.gr.',
  },
};
