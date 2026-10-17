export const TEST_MODES = Object.freeze({ timed: 'timed', passage: 'passage' });
export const TEST_DURATIONS = Object.freeze([15, 30, 60, 120]);
export const DIFFICULTIES = Object.freeze({
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
});
export const CARET_STYLES = Object.freeze({
  line: 'line',
  block: 'block',
  underline: 'underline',
});
export const KEYBOARD_SHORTCUTS = Object.freeze({
  restart: 'Escape',
  newText: 'Tab',
  nextTest: 'Enter',
});
export const DEFAULT_TEST_SETTINGS = Object.freeze({
  theme: 'system',
  fontSize: 'medium',
  caretStyle: CARET_STYLES.line,
  showLiveStats: true,
});
