import { Suspense } from 'react';

import { Spinner } from '@/common-components';
import { AuthPage } from '@/features/auth';

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to keep your Keystroke profile and certificates safe.',
};

export default function SignInPage() {
  return (
    <Suspense fallback={<Spinner label="Loading sign in" />}>
      <AuthPage />
    </Suspense>
  );
}
