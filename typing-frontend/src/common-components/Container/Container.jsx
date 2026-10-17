import { cn } from '@/utils/cn';
import styles from './Container.module.scss';

/** @param {{ children: import('react').ReactNode, size?: 'sm'|'md'|'lg', className?: string }} props */
export function Container({ children, size = 'lg', className, ...rest }) {
  return (
    <div
      className={cn(styles.container, styles[`container--${size}`], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
