import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonOutput, PostizError } from '../lib/postiz.mjs';

/**
 * The Postiz CLI prints a friendly line before its payload, so the JSON has to
 * be pulled out of the output rather than parsed wholesale.
 */

test('a JSON array after a friendly line is parsed', () => {
  const output = 'Found 3 integrations\n[{"id":"1","identifier":"instagram"}]';
  const parsed = parseJsonOutput(output);
  assert.deepEqual(parsed, [{ id: '1', identifier: 'instagram' }]);
});

test('a JSON object after a friendly line is parsed', () => {
  const output = 'Post created\n{"id":"abc","state":"scheduled"}';
  const parsed = parseJsonOutput(output);
  assert.equal(parsed.id, 'abc');
});

test('output with trailing noise still yields the object', () => {
  const output = 'Done: {"id":"abc"}\nSome trailing message';
  const parsed = parseJsonOutput(output);
  assert.equal(parsed.id, 'abc');
});

test('empty output is null', () => {
  assert.equal(parseJsonOutput(''), null);
  assert.equal(parseJsonOutput(null), null);
});

test('output with no JSON at all is null', () => {
  assert.equal(parseJsonOutput('nothing to see here'), null);
});

test('unparseable JSON is an error, not a silent null', () => {
  assert.throws(() => parseJsonOutput('{"id": "abc"'), PostizError);
});
