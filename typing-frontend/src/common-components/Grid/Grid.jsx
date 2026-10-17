import { cn } from '@/utils/cn';
import styles from './Grid.module.scss';

/** @param {{ children: import('react').ReactNode, columns?: 1|2|3|4, gap?: 'sm'|'md'|'lg', className?: string }} props */
export function Grid({
  children,
  columns = 2,
  gap = 'md',
  className,
  ...rest
}) {
  return (
    <div
      className={cn(
        styles.grid,
        styles[`grid--${columns}`],
        styles[`grid--${gap}`],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
