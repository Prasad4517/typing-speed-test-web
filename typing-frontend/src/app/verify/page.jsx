import { VerifyPage } from '@/features/verify/verify-page';

export const metadata = {
  title: 'Verify a certificate',
  description: 'Verify a Keystroke typing certificate by its certificate ID.',
};

export default function VerifyRoute() {
  return <VerifyPage />;
}
