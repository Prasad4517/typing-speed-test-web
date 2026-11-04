import { Suspense } from 'react';

import { Spinner } from '@/common-components';
import { AuthPage } from '@/features/auth';
import { AUTH_VIEW } from '@/features/auth/auth.constants';

export const metadata = {
  title: 'Create account',
  description: 'Create your Keystroke account and make every result count.',
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<Spinner label="Loading account creation" />}>
      <AuthPage view={AUTH_VIEW.signUp} />
    </Suspense>
  );
}
