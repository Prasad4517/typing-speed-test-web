import Link from 'next/link';

import { siteConfig } from '@/config/site';
import styles from './site-footer.module.scss';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div>
          <strong>{siteConfig.name}</strong>
          <p>Focused practice for speed, accuracy, and flow.</p>
        </div>
        <nav aria-label="Footer navigation">
          {siteConfig.navItems.map((item) => (
            <Link href={item.href} key={item.key}>
              {item.label}
            </Link>
          ))}
        </nav>
        <small>
          © {new Date().getFullYear()} {siteConfig.name}
        </small>
      </div>
    </footer>
  );
}
