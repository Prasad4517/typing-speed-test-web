'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/common-components';
import { siteConfig } from '@/config/site';
import { ThemeToggle } from './theme-toggle';
import styles from './home-navigation.module.scss';

export function HomeNavigation() {
  const pathname = usePathname();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <Logo />
        <nav aria-label="Primary navigation" className={styles.nav}>
          {siteConfig.navItems.map((item) => (
            <Link
              aria-current={pathname === item.href ? 'page' : undefined}
              href={item.href}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </footer>
  );
}
