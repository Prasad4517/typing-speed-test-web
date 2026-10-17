'use client';

import { useEffect } from 'react';

import { Container, ErrorState } from '@/common-components';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') console.error(error);
  }, [error]);
  return (
    <div className="page-shell">
      <Container size="sm">
        <ErrorState message="This page could not be loaded." onRetry={reset} />
      </Container>
    </div>
  );
}
