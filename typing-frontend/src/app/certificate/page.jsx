import { CertificatePage } from '@/features/certificate/certificate-page';

export const metadata = {
  title: 'My certificates',
  description:
    'Prepare a verified typing certificate and check issued certificates.',
};

export default function CertificateRoute() {
  return <CertificatePage />;
}
