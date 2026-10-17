import Link from 'next/link';

import { siteConfig } from '@/config/site';
import styles from './Logo.module.scss';

/** @param {{ href?: string, compact?: boolean }} props */
export function Logo({ href = '/', compact = false }) {
  const content = (
    <>
      <span className={styles.mark}>{siteConfig.shortName}</span>
      {compact ? null : <span className={styles.name}>{siteConfig.name}</span>}
    </>
  );
  return (
    <Link
      aria-label={`${siteConfig.name} home`}
      className={styles.logo}
      href={href}
    >
      {content}
    </Link>
  );
}
