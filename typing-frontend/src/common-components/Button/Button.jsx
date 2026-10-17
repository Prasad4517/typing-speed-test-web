import Link from 'next/link';

import { cn } from '@/utils/cn';
import { Spinner } from '../Spinner';
import styles from './Button.module.scss';

/** @param {{ children: import('react').ReactNode, href?: string, variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'sm'|'md'|'lg', loading?: boolean, disabled?: boolean, className?: string }} props */
export function Button({
  children,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className,
  ...rest
}) {
  const content = (
    <>
      {loading ? <Spinner size="sm" label="Loading" /> : null}
      {children}
    </>
  );
  const classNames = cn(
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    className,
  );

  if (href && !disabled && !loading)
    return (
      <Link className={classNames} href={href} {...rest}>
        {content}
      </Link>
    );
  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      type="button"
      {...rest}
    >
      {content}
    </button>
  );
}
