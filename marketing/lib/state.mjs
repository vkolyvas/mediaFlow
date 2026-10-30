/**
 * Content lifecycle.
 *
 *   IDEA -> GENERATED -> VALIDATED -> APPROVED -> SCHEDULED -> PUBLISHED
 *
 * FAILED is reachable from any state. REJECTED is a terminal state used when a
 * human declines a post. Nothing may be scheduled unless it is APPROVED - the
 * scheduler enforces this, it is not a convention.
 */
export const STATES = {
  IDEA: 'IDEA',
  GENERATED: 'GENERATED',
  VALIDATED: 'VALIDATED',
  APPROVED: 'APPROVED',
  SCHEDULED: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
};

const TRANSITIONS = {
  IDEA: ['GENERATED', 'FAILED', 'REJECTED'],
  GENERATED: ['VALIDATED', 'FAILED', 'REJECTED', 'IDEA'],
  VALIDATED: ['APPROVED', 'FAILED', 'REJECTED', 'GENERATED'],
  APPROVED: ['SCHEDULED', 'FAILED', 'REJECTED'],
  SCHEDULED: ['PUBLISHED', 'FAILED', 'APPROVED'],
  PUBLISHED: [],
  FAILED: ['IDEA', 'GENERATED'],
  REJECTED: ['IDEA'],
};

export function canTransition(from, to) {
  if (from === to) return false;
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal content state transition: ${from} -> ${to}`);
  }
  return to;
}

export function isTerminal(state) {
  return state === STATES.PUBLISHED || state === STATES.REJECTED;
}

/** States a human may still act on. */
export const ACTIONABLE = [STATES.GENERATED, STATES.VALIDATED];

export const ALL_STATES = Object.values(STATES);
