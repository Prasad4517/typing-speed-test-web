'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import {
  Button,
  Card,
  Container,
  EmptyState,
  ErrorState,
  Skeleton,
  StatCard,
  Table,
} from '@/common-components';
import { CERTIFICATE_COPY, CERTIFICATE_PRICE } from '@/constants/certificate';
import { ROUTES } from '@/constants/routes';
import { useTypingStore } from '@/store/use-typing-store';

const LineChart = dynamic(
  () =>
    import('@/common-components/LineChart').then((module) => module.LineChart),
  { ssr: false, loading: () => <Skeleton height="240px" /> },
);

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function ResultsPage() {
  const lastResult = useTypingStore((state) => state.lastResult);
  const history = useTypingStore((state) => state.history);
  const summary = useTypingStore((state) => state.summary);
  const analyticsLoading = useTypingStore((state) => state.analyticsLoading);
  const analyticsError = useTypingStore((state) => state.analyticsError);
  const loadLastResult = useTypingStore((state) => state.loadLastResult);
  const loadAnalytics = useTypingStore((state) => state.loadAnalytics);

  useEffect(() => {
    loadLastResult();
    loadAnalytics();
  }, [loadAnalytics, loadLastResult]);

  const rows = history.map((result) => ({
    ...result,
    session: `${result.mode} test`,
    accuracyLabel: `${result.accuracy}%`,
    date: formatDate(result.createdAt),
  }));
  return (
    <div className="page-shell page-shell--subpage">
      <Container>
        <section className="subpage-heading">
          <div>
            <p className="kicker">Verified practice log</p>
            <h1>
              Progress, <em>in focus.</em>
            </h1>
          </div>
          <Button href={ROUTES.home}>Start a new test →</Button>
        </section>
        {analyticsError ? (
          <ErrorState
            message={analyticsError.message}
            onRetry={loadAnalytics}
          />
        ) : null}
        <section className="results-overview">
          <StatCard
            label="Latest WPM"
            value={lastResult?.wpm ?? '—'}
            detail="backend verified"
          />
          <StatCard
            label="Best WPM"
            value={summary?.bestWpm || '—'}
            detail="all submitted sessions"
          />
          <StatCard
            label="Latest accuracy"
            value={lastResult ? `${lastResult.accuracy}%` : '—'}
            detail="characters correct"
          />
        </section>
        {lastResult ? (
          <section
            className="certificate-result-banner"
            aria-labelledby="certificate-result-title"
          >
            <div>
              <span className="eyebrow">{CERTIFICATE_COPY.readyToClaim}</span>
              <h2 id="certificate-result-title">
                Your verified result is ready to claim.
              </h2>
              <p>
                Add a name, then receive a certificate with its own verification
                ID.
              </p>
            </div>
            <Button href={ROUTES.certificate}>
              {CERTIFICATE_COPY.getCertificate} · {CERTIFICATE_PRICE} →
            </Button>
          </section>
        ) : null}
        <Card tone="dark" className="analytics-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Speed analysis</span>
              <h2>See the trend.</h2>
            </div>
            <span className="muted-label">Backend history</span>
          </div>
          {analyticsLoading ? (
            <Skeleton height="240px" />
          ) : summary?.trend?.length ? (
            <LineChart data={summary.trend} />
          ) : (
            <EmptyState
              title="Your trend starts here."
              description="Complete a verified test to unlock your speed history."
              action={<Button href={ROUTES.home}>Take the typing test</Button>}
              tone="dark"
            />
          )}
        </Card>
        <Card tone="dark" className="history-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Recent sessions</span>
              <h2>Keep showing up.</h2>
            </div>
            <span className="muted-label">Verified history</span>
          </div>
          <Table
            columns={[
              { key: 'session', label: 'Session' },
              { key: 'wpm', label: 'WPM' },
              { key: 'accuracyLabel', label: 'Accuracy' },
              { key: 'date', label: 'Date' },
            ]}
            empty={
              <EmptyState
                title="Your first verified result is waiting."
                action={
                  <Button href={ROUTES.home}>Take the typing test</Button>
                }
                tone="dark"
              />
            }
            rows={rows}
            tone="dark"
          />
        </Card>
      </Container>
    </div>
  );
}
