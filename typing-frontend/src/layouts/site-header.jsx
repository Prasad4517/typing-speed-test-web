'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AccountMenu, IconButton, Logo } from '@/common-components';
import { siteConfig } from '@/config/site';
import { ROUTES } from '@/constants/routes';
import { ThemeToggle } from './theme-toggle';
import styles from './site-header.module.scss';

/**
 * The shared application header receives account state from AppShell, keeping
 * authentication concerns out of presentational layout components.
 */
export function SiteHeader({ user, onSignOut, isAuthLoading = false }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(item) {
    return (
      pathname === item.href ||
      (item.href !== ROUTES.home && pathname.startsWith(item.href)) ||
      (item.key === 'progress' && pathname === ROUTES.results)
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Logo />
        <nav
          aria-label="Main navigation"
          className={`${styles.nav} ${open ? styles.open : ''}`}
        >
          {siteConfig.navItems.map((item) => (
            <Link
              aria-current={isActive(item) ? 'page' : undefined}
              className={isActive(item) ? styles.active : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <ThemeToggle />
          {isAuthLoading ? (
            <span
              aria-label="Loading account"
              className={styles.accountLoading}
            />
          ) : (
            <AccountMenu onSignOut={onSignOut} user={user} />
          )}
          <IconButton
            label={open ? 'Close navigation' : 'Open navigation'}
            className={styles.menu}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? '×' : '☰'}
          </IconButton>
        </div>
      </div>
    </header>
  );
}
