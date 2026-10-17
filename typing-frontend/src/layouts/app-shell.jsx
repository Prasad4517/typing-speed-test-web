import { ToastProvider } from '@/common-components';
import { RouteShell } from './route-shell';

export function AppShell({ children }) {
  return (
    <ToastProvider>
      <RouteShell>{children}</RouteShell>
    </ToastProvider>
  );
}
