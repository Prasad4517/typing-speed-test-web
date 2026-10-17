import { cn } from '@/utils/cn';
import styles from './IconButton.module.scss';

/** @param {{ children: import('react').ReactNode, label: string, size?: 'sm'|'md', className?: string }} props */
export function IconButton({
  children,
  label,
  size = 'md',
  className,
  ...rest
}) {
  return (
    <button
      aria-label={label}
      className={cn(styles.button, styles[`button--${size}`], className)}
      type="button"
      {...rest}
    >
      {children}
    </button>
  );
}
