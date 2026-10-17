import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  startTest: vi.fn(),
  resetTyping: vi.fn(),
  setPhase: vi.fn(),
  setTypedText: vi.fn(),
  submitTest: vi.fn(),
  store: null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@/store/use-typing-store', () => ({
  useTypingStore: (selector) => selector(mocks.store),
}));

import TypingTest from '@/components/typing/typing-test';

function createCompletedStore() {
  return {
    session: {
      testId: 'd4d80833-1111-4222-8333-444444444444',
      text: 'A verified typing result.',
    },
    typedText: 'A verified typing result.',
    phase: 'complete',
    error: null,
    lastResult: { wpm: 64, accuracy: 94.1, elapsedMs: 15000 },
    startTest: mocks.startTest,
    resetTyping: mocks.resetTyping,
    setPhase: mocks.setPhase,
    setTypedText: mocks.setTypedText,
    submitTest: mocks.submitTest,
  };
}

describe('typing test completion controls', () => {
  beforeEach(() => {
    mocks.routerPush.mockReset();
    mocks.startTest.mockReset();
    mocks.resetTyping.mockReset();
    mocks.setPhase.mockReset();
    mocks.setTypedText.mockReset();
    mocks.submitTest.mockReset();
    mocks.store = createCompletedStore();
  });

  it('keeps the completion actions above the typing input layer', () => {
    render(<TypingTest />);

    mocks.startTest.mockClear();

    const completion = screen
      .getByRole('heading', { name: /your result is verified/i })
      .closest('div');
    const actions = within(completion);

    expect(
      screen.queryByLabelText(/type the text shown above/i),
    ).not.toBeInTheDocument();
    expect(
      actions.getByRole('link', { name: /claim certificate/i }),
    ).toHaveAttribute('href', '/certificate');

    fireEvent.click(actions.getByRole('button', { name: /view progress/i }));
    expect(mocks.routerPush).toHaveBeenCalledWith('/progress');

    fireEvent.click(actions.getByRole('button', { name: /^new test$/i }));
    expect(mocks.startTest).toHaveBeenCalledWith({
      mode: 'timed',
      duration: 30,
    });
  });
});
