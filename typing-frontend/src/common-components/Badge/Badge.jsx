import styles from './Badge.module.scss';

/** @param {{ children: import('react').ReactNode, tone?: 'neutral'|'accent'|'success'|'danger' }} props */
export function Badge({ children, tone = 'neutral' }) {
  return (
    <span className={`${styles.badge} ${styles[`badge--${tone}`]}`}>
      {children}
    </span>
  );
}
