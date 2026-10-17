import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import styles from './route-shell.module.scss';

export function RouteShell({ children, user, onSignOut, isAuthLoading }) {
  return (
    <div className={styles.shell}>
      <SiteHeader
        isAuthLoading={isAuthLoading}
        onSignOut={onSignOut}
        user={user}
      />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}
