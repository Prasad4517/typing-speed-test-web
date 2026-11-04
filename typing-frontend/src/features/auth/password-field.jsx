'use client';

import { useId, useState } from 'react';

import { TextField } from '@/common-components';
import { cn } from '@/utils/cn';

import { getPasswordStrength } from './auth-validation';
import styles from './password-field.module.scss';

export function PasswordField({ showStrength = false, value = '', ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const generatedId = useId();
  const id = props.id || `password-${generatedId.replace(/:/g, '')}`;
  const strength = getPasswordStrength(value);

  return (
    <div className={styles.root}>
      <TextField
        {...props}
        endAdornment={
          <button
            aria-controls={id}
            aria-label={`${isVisible ? 'Hide' : 'Show'} ${props.label?.toLowerCase() || 'password'}`}
            className={styles.reveal}
            onClick={() => setIsVisible((current) => !current)}
            type="button"
          >
            {isVisible ? 'Hide' : 'Show'}
          </button>
        }
        id={id}
        type={isVisible ? 'text' : 'password'}
        value={value}
      />
      {showStrength && value ? (
        <div className={styles.strength}>
          <div aria-hidden="true" className={styles.track}>
            {[1, 2, 3, 4].map((step) => (
              <span
                className={cn(step <= strength.score && styles.active)}
                key={step}
              />
            ))}
          </div>
          <span aria-live="polite">Password strength: {strength.label}</span>
        </div>
      ) : null}
    </div>
  );
}
