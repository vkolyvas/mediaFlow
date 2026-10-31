// Ultrademo flow: WeddingWise - the couple planning journey.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// Signed in as the seeded demo couple (demo@weddingwise.test). The tour walks
// the real "Maria & Giannis" workspace: the planning dashboard, the checklist,
// the budget tracker, the guest list, the day timeline, the seating chart and
// the messages inbox - all populated by the demo seed.
//
// Most scenes are recorded clips: the pointer searches the checklist, opens
// the budget form, flips the calendar between views, switches the seating
// chart tools and looks up a guest - the real product, on camera.

import {
  CONVERSATION_ID,
  OVERLAY_SCRIPT,
  WEDDING_ID,
  goTo,
  hoverControls,
  idlePointer,
  signIn,
} from '../../lib/ww.mjs';

const W = `/my-wedding/${WEDDING_ID}`;

export default {
  title: 'WeddingWise - planning your wedding',
  template: 'walkthrough',
  colorScheme: 'light',
  brand: '#e11d48',
  caption: {theme: 'outline', size: 'md', position: 'bottom'},
  inject: OVERLAY_SCRIPT,

  setup: async (page) => {
    await signIn(page, 'couple');
  },

  intro: {
    title: 'For couples',
    subtitle: 'Your entire wedding, one workspace',
    script:
      'This is what planning a WeddingWise wedding actually looks like. One workspace, from first idea to final seating chart.',
  },

  scenes: [
    {
      id: 's1-dashboard',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, W, 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        for (const label of ['Guest List', 'Seating Chart', 'Checklist', 'Budget Tracker']) {
          await rec.moveTo(`a:visible:has-text("${label}")`);
          await rec.pause(650);
        }
        await rec.scroll(360);
        await rec.pause(900);
        await idlePointer(page, rec, 1);
      },
      script:
        'Everything for Maria and Giannis lives on one dashboard. Your plan, the key milestones, and every planning tool one click away.',
    },

    {
      id: 's2-details',
      prepare: async (page) => {
        await goTo(page, `${W}/details`, 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'It starts with the wedding itself. Name, date, location, and the vision you want, written once and shared with everyone you work with.',
    },

    {
      id: 's2b-checklist',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/checklist`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.type('input:visible[placeholder="Search tasks..."]', 'photographer');
        await rec.pause(1600);
        await hoverControls(page, rec, {count: 2, pause: 700, left: 300});
        await rec.scroll(300);
        await rec.pause(600);
      },
      script:
        'The checklist starts from a recommended plan built around your date, and every task carries its own priority, deadline, and owner.',
    },

    {
      id: 's3-budget',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/budget`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('button:visible:has-text("Add Item")');
        await rec.pause(700);
        await rec.click('button:visible:has-text("Add Item")');
        await rec.pause(1500);
        await page.keyboard.press('Escape');
        await rec.pause(700);
        await hoverControls(page, rec, {count: 3, pause: 700, left: 300});
      },
      script:
        'The budget tracker breaks every euro down by category, so you always know what is spent, what is pending, and what is still available.',
    },

    {
      id: 's3b-calendar',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/calendar`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("Week")');
        await rec.pause(1200);
        await rec.click('button:visible:has-text("Day")');
        await rec.pause(1200);
        await rec.click('button:visible:has-text("Month")');
        await rec.pause(1200);
        await rec.click('button:visible[aria-label="Next month"]');
        await rec.pause(1200);
      },
      script:
        'One calendar holds the wedding day, every upcoming task, and every booking you have made with a vendor.',
    },

    {
      id: 's4-guests',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/guests`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("side (18)")');
        await rec.pause(1600);
        await rec.type('input:visible[placeholder*="Search guests"]', 'maria');
        await rec.pause(1600);
        await idlePointer(page, rec, 1);
      },
      script:
        'Fifty guests, split by side, tracked from invitation to confirmed to declined, with the whole list importable and exportable from Excel.',
    },

    {
      id: 's5-timeline',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/timeline`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.moveTo('button:visible:has-text("Save Timeline")');
        await rec.pause(600);
        await rec.click('button:visible[title="Add event"]');
        await rec.pause(1600);
        await page.keyboard.press('Escape');
        await rec.pause(700);
        await rec.scroll(300);
        await rec.pause(800);
        await idlePointer(page, rec, 1);
      },
      script:
        'The day timeline turns the plan into a running order. Hair and makeup at ten, photos at one, guest arrival at half past three.',
    },

    {
      id: 's6-seating',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, `${W}/seating-chart`, 4000);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:visible:has-text("Guests")');
        await rec.pause(1200);
        await rec.click('button:visible:has-text("Table")');
        await rec.pause(1200);
        await rec.click('button:visible:has-text("Element")');
        await rec.pause(1200);
        await rec.moveTo('button:visible:has-text("Finalize")');
        await rec.pause(800);
      },
      script:
        'The seating chart pulls your confirmed guests straight in, warns you who is still unseated, and exports the finished layout to PDF.',
    },

    {
      id: 's7-messages',
      media: 'clip',
      prepare: async (page) => {
        // /messages alone redirects to the wedding picker - the inbox lives at
        // /messages/<conversationId>, seeded with the couple's vendor threads.
        await goTo(page, `/messages/${CONVERSATION_ID}`, 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.type('input:visible[placeholder*="Search messages"]', 'photo');
        await rec.pause(1600);
        await hoverControls(page, rec, {count: 3, pause: 700, left: 350});
      },
      script:
        'And every conversation with a vendor lives beside the plan, so the thread about the tasting never gets lost in an inbox.',
    },
  ],

  outro: {
    title: 'Plan your wedding free',
    subtitle: 'weddingwise.gr',
    url: 'weddingwise.gr',
    script:
      'Checklist, budget, guests, seating, and vendors in one quiet place. Start planning free at weddingwise.gr.',
  },
};
