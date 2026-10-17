'use client';

import { usePathname } from 'next/navigation';

import { SiteFooter } from './site-footer';
import { HomeNavigation } from './home-navigation';
import { SiteHeader } from './site-header';
import styles from './route-shell.module.scss';

export function RouteShell({ children }) {
  const pathname = usePathname();
  const isTestRoute = pathname === '/';

  if (isTestRoute) {
    return (
      <div className={styles.testShell}>
        <main className={styles.testMain}>{children}</main>
        <HomeNavigation />
      </div>
    );
  }

  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
