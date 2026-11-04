import { Suspense } from 'react';

import { Spinner } from '@/common-components';
import { AuthPage } from '@/features/auth';
import { AUTH_VIEW } from '@/features/auth/auth.constants';

export const metadata = {
  title: 'Forgot password',
  description: 'Request secure password reset instructions for Keystroke.',
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<Spinner label="Loading account recovery" />}>
      <AuthPage view={AUTH_VIEW.forgotPassword} />
    </Suspense>
  );
}
