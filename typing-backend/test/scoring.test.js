import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateScore,
  countCorrectChars,
} from '../src/services/scoring.service.js';

test('countCorrectChars handles empty, perfect, and incorrect input', () => {
  assert.equal(countCorrectChars('abc', ''), 0);
  assert.equal(countCorrectChars('abc', 'abc'), 3);
  assert.equal(countCorrectChars('abc', 'xyz'), 0);
  assert.equal(countCorrectChars('abc', 'abx'), 2);
});

test('calculateScore returns zero accuracy for empty input', () => {
  const score = calculateScore({
    expectedText: 'abc',
    typedText: '',
    elapsedMs: 1000,
  });
  assert.equal(score.correctChars, 0);
  assert.equal(score.accuracy, 0);
  assert.equal(score.rawWpm, 0);
});

test('calculateScore measures perfect input', () => {
  const score = calculateScore({
    expectedText: 'hello',
    typedText: 'hello',
    elapsedMs: 60000,
  });
  assert.equal(score.correctChars, 5);
  assert.equal(score.incorrectChars, 0);
  assert.equal(score.wpm, 1);
  assert.equal(score.accuracy, 100);
});

test('calculateScore counts incorrect characters at the same positions', () => {
  const score = calculateScore({
    expectedText: 'hello',
    typedText: 'hxllo',
    elapsedMs: 60000,
  });
  assert.equal(score.correctChars, 4);
  assert.equal(score.incorrectChars, 1);
  assert.equal(score.accuracy, 80);
});
