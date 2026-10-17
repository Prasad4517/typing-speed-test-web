export function calculateStats({ typedText, targetText, elapsedMs }) {
  const typed = typedText.slice(0, targetText.length);
  let correctCharacters = 0;

  for (let index = 0; index < typed.length; index += 1) {
    if (typed[index] === targetText[index]) correctCharacters += 1;
  }

  const minutes = Math.max(elapsedMs, 1) / 60000;
  const words = correctCharacters / 5;

  return {
    wpm: Math.round((words / minutes) * 10) / 10,
    rawWpm: Math.round((typed.length / 5 / minutes) * 10) / 10,
    accuracy: typed.length
      ? Math.round((correctCharacters / typed.length) * 1000) / 10
      : 0,
    correctCharacters,
    incorrectCharacters: Math.max(typed.length - correctCharacters, 0),
    characters: typed.length,
  };
}

export function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
