import { forwardRef } from 'react';

import { cn } from '@/utils/cn';
import styles from './TextField.module.scss';

/** @type {import('react').ForwardRefExoticComponent<any>} */
export const TextField = forwardRef(function TextField(
  { label, hint, error, id, className, endAdornment, ...rest },
  ref,
) {
  const inputId = id || `field-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className={cn(styles.field, className)}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <div className={styles.inputWrap}>
        <input
          aria-describedby={hint || error ? `${inputId}-help` : undefined}
          aria-invalid={Boolean(error)}
          className={styles.input}
          id={inputId}
          ref={ref}
          {...rest}
        />
        {endAdornment ? (
          <span className={styles.adornment}>{endAdornment}</span>
        ) : null}
      </div>
      {error || hint ? (
        <span
          className={cn(styles.help, error && styles.error)}
          id={`${inputId}-help`}
        >
          {error || hint}
        </span>
      ) : null}
    </div>
  );
});
