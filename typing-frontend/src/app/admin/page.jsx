import { DashboardPage } from '@/features/auth';

export const metadata = {
  title: 'Admin dashboard',
  description: 'Authorized Keystroke administration.',
};

export default function AdminDashboardRoute() {
  return <DashboardPage admin />;
}
