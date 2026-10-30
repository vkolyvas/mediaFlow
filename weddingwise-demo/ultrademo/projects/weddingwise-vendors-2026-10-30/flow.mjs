// Ultrademo flow: WeddingWise - the vendor business workspace.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// Signed in as the seeded demo vendor (demo-vendor@weddingwise.test, "Aegean
// Photography"). The tour covers the vendor workspace dashboard, the lead
// pipeline, the incoming requests queue and the client list - all populated by
// the demo seed.

import {OVERLAY_SCRIPT, goTo, signIn} from '../../lib/ww.mjs';

export default {
  title: 'WeddingWise - running your vendor business',
  template: 'walkthrough',
  colorScheme: 'light',
  brand: '#e11d48',
  caption: {theme: 'outline', size: 'md', position: 'bottom'},
  inject: OVERLAY_SCRIPT,

  setup: async (page) => {
    await signIn(page, 'vendor');
  },

  intro: {
    title: 'For vendors',
    subtitle: 'Your business, in one workspace',
    script:
      'Vendors do not need a website, an inbox, a calendar, and an invoicing tool. They need one workspace that does all of it.',
  },

  scenes: [
    {
      id: 's1-dashboard',
      prepare: async (page) => {
        await goTo(page, '/vendor/dashboard', 4500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
      script:
        'Aegean Photography opens on its business dashboard: rating, plan, and verified status at the top, with your inbox and profile one click away.',
    },

    {
      id: 's2-leads',
      media: 'clip',
      prepare: async (page) => {
        await goTo(page, '/vendor/leads', 3500);
      },
      settleMs: 800,
      record: async (page, rec) => {
        await rec.click('button:has-text("booked (1)")');
        await rec.pause(1600);
      },
      script:
        'Every enquiry becomes a lead in a real pipeline. New, inquiry, quote sent, negotiation, booked, completed - you always know exactly where each one stands.',
    },

    {
      id: 's2b-financials',
      prepare: async (page) => {
        await goTo(page, '/vendor/financials', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'Contracts and invoices sit against the wedding they belong to, so you always know what is owed, what is paid, and what is outstanding.',
    },

    {
      id: 's3-requests',
      prepare: async (page) => {
        await goTo(page, '/vendor/requests', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'Planner invitations, couple inquiries, and booking requests all arrive in one queue, so nothing waits in a personal inbox to be answered.',
    },

    {
      id: 's4-clients',
      prepare: async (page) => {
        await goTo(page, '/vendor/clients', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'Once you are booked, the wedding becomes a client workspace with its own bookings, contract, invoices, and next action.',
    },

    {
      id: 's4b-reviews',
      prepare: async (page) => {
        await goTo(page, '/vendor/reviews', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.3,
      script:
        'Reviews land on your public profile, where you can reply to the happy clients and answer the concerns.',
    },

    {
      id: 's5-calendar',
      prepare: async (page) => {
        await goTo(page, '/vendor/calendar', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
      script:
        'A calendar of the dates you have blocked, so couples can only ask you for days you actually work.',
    },
  {
      id: 's6-public-profile',
      prepare: async (page) => {
        await goTo(page, '/vendors/aegean-photography', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'And the same profile is what a couple lands on when they find you, with your gallery, your pricing, and a booking request button.',
    },
  ],

  outro: {
    title: 'List your business free',
    subtitle: 'weddingwise.gr',
    url: 'weddingwise.gr',
    script:
      'Free to list, and you keep your leads. List your business at weddingwise.gr.',
  },
};
