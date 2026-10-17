'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/common-components';
import { siteConfig } from '@/config/site';
import { CERTIFICATE_PRICE } from '@/constants/certificate';
import { ROUTES } from '@/constants/routes';
import { KEYBOARD_SHORTCUTS } from '@/constants/test-config';
import {
  TYPING_TEST_COPY,
  TYPING_VIEWPORT,
} from '@/features/typing-test/typing-test.constants';
import { calculateStats, formatTime } from '@/lib/typing-engine';
import { useTypingStore } from '@/store/use-typing-store';

import styles from './typing-test.module.scss';

function TextDisplay({ text, typedText }) {
  const windowStart = Math.max(
    0,
    typedText.length - TYPING_VIEWPORT.completedCharacterHistory,
  );
  const windowEnd = Math.min(
    text.length,
    typedText.length + TYPING_VIEWPORT.visibleCharacters,
  );
  const visibleText = text.slice(windowStart, windowEnd);

  return (
    <div className={styles.textDisplay} aria-hidden="true">
      {visibleText.split('').map((character, index) => {
        const textIndex = windowStart + index;
        const typedCharacter = typedText[textIndex];
        const characterState =
          typedCharacter == null
            ? 'pending'
            : typedCharacter === character
              ? 'correct'
              : 'incorrect';
        const isCurrent = textIndex === typedText.length;

        return (
          <span
            className={`${styles.character} ${styles[`character--${characterState}`]} ${
              isCurrent ? styles['character--current'] : ''
            }`}
            key={`${textIndex}-${character}`}
          >
            {character}
          </span>
        );
      })}
    </div>
  );
}

function CompletionState({ result, onNewTest, onViewProgress }) {
  return (
    <div className={styles.completion} role="status">
      <span className={styles.completionMark} aria-hidden="true">
        ✓
      </span>
      <span className={styles.statusLabel}>
        {TYPING_TEST_COPY.sessionVerified}
      </span>
      <h2>{TYPING_TEST_COPY.resultTitle}</h2>
      <p>
        {result.wpm} {TYPING_TEST_COPY.stats.wpm} · {result.accuracy}%{' '}
        {TYPING_TEST_COPY.stats.accuracy}
      </p>
      <div className={styles.completionActions}>
        <Button href={ROUTES.certificate} size="sm">
          {TYPING_TEST_COPY.claimCertificate} · {CERTIFICATE_PRICE}{' '}
          <span aria-hidden="true">→</span>
        </Button>
        <Button onClick={onViewProgress} size="sm" variant="secondary">
          {TYPING_TEST_COPY.viewProgress} <span aria-hidden="true">→</span>
        </Button>
        <Button onClick={onNewTest} size="sm" variant="secondary">
          {TYPING_TEST_COPY.newTest}
        </Button>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }) {
  return (
    <div className={styles.errorState} role="alert">
      <div>
        <span className={styles.statusLabel}>
          {TYPING_TEST_COPY.sessionLabel}
        </span>
        <strong>{error?.message || TYPING_TEST_COPY.serviceUnavailable}</strong>
      </div>
      <Button onClick={onRetry} size="sm">
        {TYPING_TEST_COPY.retry} <span aria-hidden="true">↗</span>
      </Button>
    </div>
  );
}

function getSessionStatus(phase, isComplete) {
  if (isComplete) return TYPING_TEST_COPY.completed;

  const statusByPhase = {
    idle: TYPING_TEST_COPY.loading,
    loading: TYPING_TEST_COPY.loading,
    ready: TYPING_TEST_COPY.ready,
    typing: TYPING_TEST_COPY.typing,
    submitting: TYPING_TEST_COPY.submitting,
  };

  return statusByPhase[phase] || TYPING_TEST_COPY.ready;
}

export default function TypingTest() {
  const router = useRouter();
  const inputRef = useRef(null);
  const firstKeystrokeAt = useRef(null);
  const submitted = useRef(false);
  const startedDuration = useRef(null);
  const [duration, setDuration] = useState(siteConfig.defaultDuration);
  const [clockMs, setClockMs] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const session = useTypingStore((state) => state.session);
  const typedText = useTypingStore((state) => state.typedText);
  const phase = useTypingStore((state) => state.phase);
  const error = useTypingStore((state) => state.error);
  const lastResult = useTypingStore((state) => state.lastResult);
  const startTest = useTypingStore((state) => state.startTest);
  const resetTyping = useTypingStore((state) => state.resetTyping);
  const setTypedText = useTypingStore((state) => state.setTypedText);
  const setPhase = useTypingStore((state) => state.setPhase);
  const submitTest = useTypingStore((state) => state.submitTest);

  const elapsedMs = firstKeystrokeAt.current ? clockMs : 0;
  const stats = useMemo(
    () =>
      calculateStats({
        typedText,
        targetText: session?.text || '',
        elapsedMs,
      }),
    [elapsedMs, session?.text, typedText],
  );
  const isLoading = phase === 'idle' || phase === 'loading';
  const isComplete = phase === 'complete' && lastResult;

  const beginTest = useCallback(() => {
    firstKeystrokeAt.current = null;
    submitted.current = false;
    setClockMs(0);
    startTest({ mode: 'timed', duration });
  }, [duration, startTest]);

  const restartSameText = useCallback(() => {
    if (!session || isLoading) {
      beginTest();
      return;
    }

    firstKeystrokeAt.current = null;
    submitted.current = false;
    setClockMs(0);
    resetTyping();
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [beginTest, isLoading, resetTyping, session]);

  useEffect(() => {
    if (startedDuration.current === duration) return;

    startedDuration.current = duration;
    beginTest();
  }, [beginTest, duration]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === KEYBOARD_SHORTCUTS.restart) {
        event.preventDefault();
        restartSameText();
        return;
      }

      if (event.key === KEYBOARD_SHORTCUTS.newText) {
        event.preventDefault();
        beginTest();
        return;
      }

      if (event.key === KEYBOARD_SHORTCUTS.nextTest && phase === 'complete') {
        beginTest();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [beginTest, phase, restartSameText]);

  useEffect(() => {
    if (phase !== 'typing' || !firstKeystrokeAt.current) return undefined;

    const timer = window.setInterval(() => {
      const currentElapsed = Math.round(
        performance.now() - firstKeystrokeAt.current,
      );
      setClockMs(currentElapsed);

      if (currentElapsed >= duration * 1000 && !submitted.current) {
        submitted.current = true;
        submitTest({ typedText, elapsedMs: duration * 1000 });
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [duration, phase, submitTest, typedText]);

  useEffect(() => {
    if (isComplete) inputRef.current?.blur();
  }, [isComplete]);

  function handleChange(event) {
    if (!session || isComplete || phase === 'submitting') return;

    const value = event.target.value.slice(0, session.text.length);
    if (!firstKeystrokeAt.current && value.length > 0) {
      firstKeystrokeAt.current = performance.now();
      setPhase('typing');
    }
    setTypedText(value);

    if (value.length >= session.text.length && !submitted.current) {
      submitted.current = true;
      const finalElapsedMs = Math.max(
        Math.round(performance.now() - firstKeystrokeAt.current),
        1,
      );
      setClockMs(finalElapsedMs);
      submitTest({ typedText: value, elapsedMs: finalElapsedMs });
    }
  }

  const visibleTime = Math.max(duration - Math.ceil(clockMs / 1000), 0);
  const status = getSessionStatus(phase, isComplete);

  return (
    <section className={styles.workspace} aria-label="Typing speed test">
      <div className={styles.toolbar}>
        <div className={styles.durationPicker} aria-label="Test duration">
          {siteConfig.testDurations.map((option) => (
            <button
              aria-pressed={duration === option}
              className={`${styles.durationOption} ${
                duration === option ? styles['durationOption--active'] : ''
              }`}
              key={option}
              onClick={() => setDuration(option)}
              type="button"
            >
              {option}s
            </button>
          ))}
        </div>

        <p className={styles.shortcuts}>
          <span>{TYPING_TEST_COPY.restart}</span>
          <span aria-hidden="true">·</span>
          <span>{TYPING_TEST_COPY.newText}</span>
        </p>
      </div>

      <div className={styles.panel}>
        {error ? <ErrorState error={error} onRetry={beginTest} /> : null}

        {!error ? (
          <>
            <div className={styles.panelHeader}>
              <span className={styles.panelStatus}>{status}</span>
              <div
                aria-label={`${
                  isComplete
                    ? formatTime(Math.round((lastResult.elapsedMs || 0) / 1000))
                    : formatTime(visibleTime)
                } ${isComplete ? TYPING_TEST_COPY.completedTime : TYPING_TEST_COPY.remaining}`}
                className={styles.timer}
                aria-live="polite"
              >
                <span className={styles.timerValue}>
                  {isComplete
                    ? formatTime(Math.round((lastResult.elapsedMs || 0) / 1000))
                    : formatTime(visibleTime)}
                </span>
              </div>
            </div>

            <div
              className={`${styles.canvas} ${isFocused ? styles['canvas--focused'] : ''}`}
              onClick={() => !isComplete && inputRef.current?.focus()}
            >
              {isComplete ? (
                <CompletionState
                  onNewTest={beginTest}
                  onViewProgress={() => router.push('/progress')}
                  result={lastResult}
                />
              ) : session?.text ? (
                <TextDisplay text={session.text} typedText={typedText} />
              ) : null}
              {!isComplete ? (
                <textarea
                  ref={inputRef}
                  aria-label="Type the text shown above"
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  className={styles.input}
                  disabled={!session || isLoading}
                  onBlur={() => setIsFocused(false)}
                  onChange={handleChange}
                  onFocus={() => setIsFocused(true)}
                  spellCheck="false"
                  value={typedText}
                />
              ) : null}
              {isLoading ? (
                <span className={styles.prompt}>
                  {TYPING_TEST_COPY.loadingHint}
                </span>
              ) : null}
              {!isLoading && !typedText && !isComplete ? (
                <span className={styles.prompt}>
                  {TYPING_TEST_COPY.startHint}
                </span>
              ) : null}
            </div>

            <div className={styles.panelFooter}>
              <div className={styles.stats} aria-live="polite">
                <span>
                  <b>{stats.wpm}</b> {TYPING_TEST_COPY.stats.wpm}
                </span>
                <span>
                  <b>{stats.accuracy}%</b> {TYPING_TEST_COPY.stats.accuracy}
                </span>
                <span>
                  <b>{stats.incorrectCharacters}</b>{' '}
                  {TYPING_TEST_COPY.stats.errors}
                </span>
              </div>
              <Button
                className={styles.newTest}
                onClick={beginTest}
                size="sm"
                variant="ghost"
              >
                {TYPING_TEST_COPY.newTest} <span aria-hidden="true">↵</span>
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
