import { forwardRef } from 'react';

import { cn } from '@/utils/cn';
import styles from './TextField.module.scss';

/** @type {import('react').ForwardRefExoticComponent<any>} */
export const TextField = forwardRef(function TextField(
  { label, hint, error, id, className, ...rest },
  ref,
) {
  const inputId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className={cn(styles.field, className)} htmlFor={inputId}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <input
        aria-describedby={hint || error ? `${inputId}-help` : undefined}
        aria-invalid={Boolean(error)}
        className={styles.input}
        id={inputId}
        ref={ref}
        {...rest}
      />
      {error || hint ? (
        <span
          className={cn(styles.help, error && styles.error)}
          id={`${inputId}-help`}
        >
          {error || hint}
        </span>
      ) : null}
    </label>
  );
});
