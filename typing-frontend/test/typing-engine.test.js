import { describe, expect, it } from 'vitest';

import { calculateStats, formatTime } from '@/lib/typing-engine';

describe('typing engine', () => {
  it('calculates perfect speed and accuracy', () => {
    const result = calculateStats({
      typedText: 'hello world',
      targetText: 'hello world',
      elapsedMs: 60000,
    });
    expect(result.wpm).toBe(2.2);
    expect(result.accuracy).toBe(100);
    expect(result.correctCharacters).toBe(11);
  });

  it('counts incorrect characters without negative values', () => {
    const result = calculateStats({
      typedText: 'hxllo',
      targetText: 'hello',
      elapsedMs: 1000,
    });
    expect(result.correctCharacters).toBe(4);
    expect(result.incorrectCharacters).toBe(1);
    expect(result.accuracy).toBe(80);
  });

  it('formats timer values consistently', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65)).toBe('1:05');
  });
});
