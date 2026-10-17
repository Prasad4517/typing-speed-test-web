import { cn } from '@/utils/cn';
import { Stack } from '../Stack';
import styles from './EmptyState.module.scss';

/** @param {{ title: string, description?: string, action?: import('react').ReactNode, tone?: 'default'|'dark' }} props */
export function EmptyState({ title, description, action, tone = 'default' }) {
  return (
    <section className={cn(styles.empty, styles[`tone--${tone}`])}>
      <Stack align="center" gap="sm">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {action}
      </Stack>
    </section>
  );
}
