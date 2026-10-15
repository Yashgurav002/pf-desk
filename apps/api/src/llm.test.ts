import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripThinking, foldSystem } from './llm.ts';

test('reasoning blocks never reach the UI', () => {
  assert.equal(stripThinking('<thought> a\nb </thought>You must fix.'), 'You must fix.');
  assert.equal(stripThinking('<think>x</think>\n{"a":1}'), '{"a":1}');
  assert.equal(stripThinking('reasoning...</thought>Answer'), 'Answer');
  assert.equal(stripThinking('Answer <thought>cut off'), 'Answer');
  assert.equal(stripThinking('plain answer'), 'plain answer');
});

test('system prompt folds into the first user turn (Gemma API)', () => {
  const r = foldSystem([{ role: 'system', content: 'S' }, { role: 'user', content: 'u1' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'u2' }]);
  assert.deepEqual(r.map((m) => m.content), ['S\n\nu1', 'a', 'u2']);
});
