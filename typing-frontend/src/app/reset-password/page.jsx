import { Suspense } from 'react';

import { Spinner } from '@/common-components';
import { ResetPasswordPage } from '@/features/auth';

export const metadata = {
  title: 'Reset password',
  description: 'Choose a new password for your Keystroke account.',
};

export default function ResetPasswordRoute() {
  return (
    <Suspense fallback={<Spinner label="Loading password reset" />}>
      <ResetPasswordPage />
    </Suspense>
  );
}
