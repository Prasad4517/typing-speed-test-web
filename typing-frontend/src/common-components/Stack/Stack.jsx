import { cn } from '@/utils/cn';
import styles from './Stack.module.scss';

/** @param {{ children: import('react').ReactNode, gap?: 'sm'|'md'|'lg', align?: string, className?: string }} props */
export function Stack({ children, gap = 'md', align, className, ...rest }) {
  return (
    <div
      className={cn(
        styles.stack,
        styles[`stack--${gap}`],
        align && styles[`stack--${align}`],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
