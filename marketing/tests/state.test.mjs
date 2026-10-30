import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, STATES, isTerminal } from '../lib/state.mjs';

test('the happy path is a straight line', () => {
  const path = [
    STATES.IDEA,
    STATES.GENERATED,
    STATES.VALIDATED,
    STATES.APPROVED,
    STATES.SCHEDULED,
    STATES.PUBLISHED,
  ];
  for (let i = 0; i < path.length - 1; i += 1) {
    assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} -> ${path[i + 1]}`);
  }
});

test('a post cannot be scheduled without being approved', () => {
  assert.equal(canTransition(STATES.GENERATED, STATES.SCHEDULED), false);
  assert.equal(canTransition(STATES.VALIDATED, STATES.SCHEDULED), false);
  assert.equal(canTransition(STATES.APPROVED, STATES.SCHEDULED), true);
});

test('a post cannot be published without being scheduled', () => {
  assert.equal(canTransition(STATES.APPROVED, STATES.PUBLISHED), false);
  assert.equal(canTransition(STATES.SCHEDULED, STATES.PUBLISHED), true);
});

test('a post cannot jump straight from idea to published', () => {
  assert.equal(canTransition(STATES.IDEA, STATES.PUBLISHED), false);
});

test('anything can fail', () => {
  for (const state of [STATES.IDEA, STATES.GENERATED, STATES.VALIDATED, STATES.APPROVED, STATES.SCHEDULED]) {
    assert.equal(canTransition(state, STATES.FAILED), true, `${state} -> FAILED`);
  }
});

test('a state never transitions to itself', () => {
  for (const state of Object.values(STATES)) {
    assert.equal(canTransition(state, state), false);
  }
});

test('assertTransition throws on an illegal move', () => {
  assert.throws(() => assertTransition(STATES.IDEA, STATES.PUBLISHED), /Illegal content state transition/);
  assert.equal(assertTransition(STATES.IDEA, STATES.GENERATED), STATES.GENERATED);
});

test('published and rejected are terminal', () => {
  assert.equal(isTerminal(STATES.PUBLISHED), true);
  assert.equal(isTerminal(STATES.REJECTED), true);
  assert.equal(isTerminal(STATES.APPROVED), false);
});
