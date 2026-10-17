'use client';

import { create } from 'zustand';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import { getStatsHistory, getStatsSummary } from '@/services/stats.service';
import {
  startTest as startTestRequest,
  submitTest as submitTestRequest,
} from '@/services/tests.service';

function readLastResult() {
  if (typeof window === 'undefined') return null;

  try {
    return JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEYS.lastResult) || 'null',
    );
  } catch {
    return null;
  }
}

export const useTypingStore = create((set, get) => ({
  session: null,
  typedText: '',
  phase: 'idle',
  error: null,
  lastResult: null,
  history: [],
  nextCursor: null,
  summary: null,
  analyticsLoading: false,
  analyticsError: null,

  startTest: async (payload) => {
    set({
      phase: 'loading',
      error: null,
      typedText: '',
      session: null,
      lastResult: null,
    });

    try {
      const session = await startTestRequest(payload);
      set({ session, phase: 'ready', error: null });
      return session;
    } catch (error) {
      set({ phase: 'error', error });
      return null;
    }
  },

  setTypedText: (typedText) => set({ typedText }),
  setPhase: (phase) => set({ phase }),

  submitTest: async ({ typedText, elapsedMs }) => {
    const session = get().session;
    if (!session) return null;

    set({ phase: 'submitting', error: null });

    try {
      const result = await submitTestRequest(session.testId, {
        typedText,
        elapsedMs,
      });
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(
          STORAGE_KEYS.lastResult,
          JSON.stringify(result),
        );
      }
      set({ phase: 'complete', lastResult: result, error: null });
      return result;
    } catch (error) {
      set({ phase: 'error', error });
      return null;
    }
  },

  loadLastResult: () => set({ lastResult: readLastResult() }),

  loadAnalytics: async () => {
    set({ analyticsLoading: true, analyticsError: null });

    try {
      const [history, summary] = await Promise.all([
        getStatsHistory(),
        getStatsSummary(),
      ]);
      set({
        history: history.entries,
        nextCursor: history.nextCursor,
        summary,
        analyticsLoading: false,
      });
    } catch (error) {
      set({ analyticsLoading: false, analyticsError: error });
    }
  },

  resetTyping: () =>
    set({ typedText: '', phase: 'ready', error: null, lastResult: null }),
}));
