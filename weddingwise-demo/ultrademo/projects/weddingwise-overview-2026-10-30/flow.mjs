// Ultrademo flow: WeddingWise - platform overview.
// Target: http://localhost:4000 (the WeddingWise Next.js app).
//
// One video across all three sides of the marketplace: the public landing page
// and marketplace, then the couple workspace, the vendor workspace, and the
// planner workspace. The flow switches demo identity between segments so a
// single take can show the whole ecosystem.

import {
  OVERLAY_SCRIPT,
  WEDDING_ID,
  goTo,
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

  setup: async (page) => {
    await signIn(page, 'couple');
  },

  intro: {
    title: 'WeddingWise',
    subtitle: 'Where couples, vendors, and planners meet',
    script:
      'WeddingWise is the platform where the three sides of a wedding finally work from the same place.',
  },

  scenes: [
    {
      id: 's1-home',
      prepare: async (page) => {
        await goTo(page, '/', 3000);
      },
      settleMs: 1200,
      target: 'h1',
      action: 'none',
      zoom: 1.15,
      script:
        'For couples, everything you need to plan a wedding in one place. For vendors and planners, a real business workspace, not a contact form.',
    },

    {
      id: 's2-marketplace',
      prepare: async (page) => {
        await goTo(page, '/vendors', 3500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'The marketplace is where it starts. Filter thousands of wedding vendors across Greece by location, date, style, and budget.',
    },

    {
      id: 's3-couple',
      prepare: async (page) => {
        await goTo(page, `/my-wedding/${WEDDING_ID}`, 4000);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
      script:
        'A couple gets one workspace for the whole wedding: checklist, budget, guests, seating, timeline, and every vendor conversation.',
    },

    {
      id: 's4-vendor',
      prepare: async (page) => {
        await switchRole(page, 'vendor');
        await goTo(page, '/vendor/leads', 4000);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.25,
      script:
        'A vendor gets a pipeline instead of a pile of enquiries. Every lead has a stage, and every booked wedding becomes a client workspace.',
    },

    {
      id: 's5-planner',
      prepare: async (page) => {
        await switchRole(page, 'planner');
        await goTo(page, '/planner', 4500);
      },
      settleMs: 1500,
      target: 'h1',
      action: 'none',
      zoom: 1.15,
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
      prepare: async (page) => {
        await goTo(page, '/for-planners', 3000);
      },
      settleMs: 1200,
      target: 'h1',
      action: 'none',
      zoom: 1.2,
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
