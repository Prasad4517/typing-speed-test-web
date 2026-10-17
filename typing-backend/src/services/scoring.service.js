export function countCorrectChars(expectedText, typedText) {
  const length = Math.min(expectedText.length, typedText.length);
  let correctChars = 0;

  for (let index = 0; index < length; index += 1) {
    if (expectedText[index] === typedText[index]) correctChars += 1;
  }

  return correctChars;
}

export function calculateScore({ expectedText, typedText, elapsedMs }) {
  const typedLength = typedText.length;
  const correctChars = countCorrectChars(expectedText, typedText);
  const incorrectChars = Math.max(typedLength - correctChars, 0);
  const elapsedMinutes = Math.max(elapsedMs, 1) / 60000;

  return {
    typedLength,
    correctChars,
    incorrectChars,
    wpm: correctChars / SCORING.charactersPerWord / elapsedMinutes,
    rawWpm: typedLength / SCORING.charactersPerWord / elapsedMinutes,
    accuracy: typedLength ? (correctChars / typedLength) * 100 : 0,
  };
}

export function roundScore(value) {
  const factor = 10 ** SCORING.scoreDecimals;
  return Math.round(value * factor) / factor;
}

export function serializeScore(score) {
  return {
    ...score,
    wpm: roundScore(score.wpm),
    rawWpm: roundScore(score.rawWpm),
    accuracy: roundScore(score.accuracy),
  };
}
import { SCORING } from '../constants/scoring.js';
