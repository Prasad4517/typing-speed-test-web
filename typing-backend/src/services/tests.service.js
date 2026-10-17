import {
  ConflictError,
  NotFoundError,
  SessionExpiredError,
  SuspiciousResultError,
} from '../utils/app-error.js';
import { MESSAGES } from '../constants/messages.js';
import { SCORING } from '../constants/scoring.js';
import { calculateScore, serializeScore } from './scoring.service.js';

function toPrismaMode(mode) {
  return mode.toUpperCase();
}

function createTimedText(words) {
  return words.join(' ');
}

export function createTestsService({
  repository,
  passagesService,
  wordsService,
  config,
  now = () => new Date(),
}) {
  async function rejectSession({ session, clientId, reason, error }) {
    await repository.markRejected({ id: session.id, clientId, reason });
    throw error;
  }

  return Object.freeze({
    async start({ clientId, mode, difficulty, duration, exclude = [] }) {
      const createdAt = now();
      let text;
      let passageKey = null;
      let selectedDifficulty = difficulty || null;
      let sessionDuration = duration || null;

      if (mode === 'passage') {
        const passage = passagesService.getRandomPassage({
          difficulty,
          exclude,
        });
        text = passage.text;
        passageKey = passage.key;
        selectedDifficulty = passage.difficulty;
      } else {
        sessionDuration = duration;
        text = createTimedText(
          wordsService.getWords({ count: Math.max(120, duration * 12) }).words,
        );
      }

      const expiresAt = new Date(
        createdAt.getTime() +
          Math.max(
            sessionDuration ? sessionDuration * 1000 : 0,
            config.sessionTtlSeconds * 1000,
          ),
      );
      const session = await repository.create({
        clientId,
        mode: toPrismaMode(mode),
        passageKey,
        text,
        difficulty: selectedDifficulty,
        duration: sessionDuration,
        createdAt,
        expiresAt,
        status: 'STARTED',
      });

      return {
        testId: session.id,
        mode,
        text,
        passageKey,
        duration: sessionDuration,
        expiresAt: session.expiresAt.toISOString(),
      };
    },

    async submit({ clientId, testId, typedText, elapsedMs }) {
      const session = await repository.findById(testId);

      if (!session || session.clientId !== clientId) {
        throw new NotFoundError(MESSAGES.testNotFound);
      }
      if (session.status === 'SUBMITTED') {
        throw new ConflictError(MESSAGES.alreadySubmitted);
      }
      if (session.status === 'REJECTED') {
        throw new ConflictError(MESSAGES.alreadyRejected);
      }

      const currentTime = now();
      if (session.expiresAt <= currentTime) {
        await rejectSession({
          session,
          clientId,
          reason: 'SESSION_EXPIRED',
          error: new SessionExpiredError(),
        });
      }

      const serverAgeMs = Math.max(
        currentTime.getTime() - session.createdAt.getTime(),
        0,
      );
      if (elapsedMs > serverAgeMs + config.timingToleranceMs) {
        await rejectSession({
          session,
          clientId,
          reason: 'ELAPSED_TIME_EXCEEDS_SERVER_AGE',
          error: new SuspiciousResultError(MESSAGES.unverifiableElapsed),
        });
      }
      if (
        session.duration &&
        elapsedMs > session.duration * 1000 + config.timingToleranceMs
      ) {
        await rejectSession({
          session,
          clientId,
          reason: 'ELAPSED_TIME_EXCEEDS_DURATION',
          error: new SuspiciousResultError(MESSAGES.elapsedTooLong),
        });
      }
      if (typedText.length > session.text.length + 5) {
        await rejectSession({
          session,
          clientId,
          reason: 'TYPED_TEXT_TOO_LONG',
          error: new SuspiciousResultError(MESSAGES.textTooLong),
        });
      }
      if (elapsedMs < config.minElapsedMs) {
        await rejectSession({
          session,
          clientId,
          reason: 'ELAPSED_TIME_TOO_SHORT',
          error: new SuspiciousResultError(MESSAGES.elapsedTooShort),
        });
      }

      const score = calculateScore({
        expectedText: session.text,
        typedText,
        elapsedMs,
      });
      if (score.wpm > SCORING.maxPlausibleWpm) {
        await rejectSession({
          session,
          clientId,
          reason: 'WPM_TOO_HIGH',
          error: new SuspiciousResultError(MESSAGES.speedUnverifiable),
        });
      }

      const result = serializeScore(score);
      const claimed = await repository.claimSubmission({
        id: session.id,
        clientId,
        data: {
          status: 'SUBMITTED',
          submittedAt: currentTime,
          ...result,
          elapsedMs,
        },
      });

      if (!claimed.count) {
        throw new ConflictError(MESSAGES.alreadySubmitted);
      }

      return { testId: session.id, ...result, elapsedMs };
    },
  });
}
