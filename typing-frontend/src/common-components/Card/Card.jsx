import { cn } from '@/utils/cn';
import styles from './Card.module.scss';

/** @param {{ children: import('react').ReactNode, tone?: 'default'|'dark', className?: string }} props */
export function Card({ children, tone = 'default', className, ...rest }) {
  return (
    <article
      className={cn(styles.card, styles[`card--${tone}`], className)}
      {...rest}
    >
      {children}
    </article>
  );
}
