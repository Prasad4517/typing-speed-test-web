import { ValidationError } from '../utils/app-error.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { roundScore } from './scoring.service.js';

function serializeHistoryItem(session) {
  return {
    testId: session.id,
    mode: session.mode.toLowerCase(),
    difficulty: session.difficulty,
    duration: session.duration,
    wpm: roundScore(session.wpm || 0),
    rawWpm: roundScore(session.rawWpm || 0),
    accuracy: roundScore(session.accuracy || 0),
    correctChars: session.correctChars,
    incorrectChars: session.incorrectChars,
    elapsedMs: session.elapsedMs,
    createdAt: session.createdAt.toISOString(),
  };
}

export function createStatsService({ repository }) {
  return Object.freeze({
    async history({ clientId, limit, cursor }) {
      const decodedCursor = cursor ? decodeCursor(cursor) : null;
      if (cursor && !decodedCursor) {
        throw new ValidationError('The history cursor is invalid.');
      }
      const sessions = await repository.findSubmitted({
        clientId,
        limit,
        cursor: decodedCursor,
      });
      const hasMore = sessions.length > limit;
      const items = sessions.slice(0, limit);
      const last = items.at(-1);

      return {
        entries: items.map(serializeHistoryItem),
        nextCursor:
          hasMore && last
            ? encodeCursor({
                id: last.id,
                createdAt: last.createdAt.toISOString(),
              })
            : null,
      };
    },

    async summary({ clientId }) {
      const [aggregate, best, modes, trendSessions] = await Promise.all([
        repository.aggregateSubmitted({ clientId }),
        repository.bestSubmitted({ clientId }),
        repository.groupByMode({ clientId }),
        repository.findSubmitted({ clientId, limit: 10 }),
      ]);

      return {
        totalTests: aggregate._count._all,
        averageWpm: roundScore(aggregate._avg.wpm || 0),
        bestWpm: roundScore(best._max.wpm || 0),
        averageAccuracy: roundScore(aggregate._avg.accuracy || 0),
        trend: trendSessions.reverse().map(serializeHistoryItem),
        breakdownByMode: modes.reduce((result, mode) => {
          result[mode.mode.toLowerCase()] = {
            totalTests: mode._count._all,
            averageWpm: roundScore(mode._avg.wpm || 0),
            averageAccuracy: roundScore(mode._avg.accuracy || 0),
          };
          return result;
        }, {}),
      };
    },
  });
}
