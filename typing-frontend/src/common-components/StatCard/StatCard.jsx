import { cn } from '@/utils/cn';
import styles from './StatCard.module.scss';

/** @param {{ label: string, value: import('react').ReactNode, detail?: string, className?: string }} props */
export function StatCard({ label, value, detail, className, ...rest }) {
  return (
    <article className={cn(styles.card, className)} {...rest}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {detail ? <div className={styles.detail}>{detail}</div> : null}
    </article>
  );
}
