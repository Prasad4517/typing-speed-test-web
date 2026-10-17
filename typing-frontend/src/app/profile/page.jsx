import { ProfilePage } from '@/features/auth';

export const metadata = {
  title: 'Your profile',
  description: 'Manage your Keystroke profile and active sessions.',
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
