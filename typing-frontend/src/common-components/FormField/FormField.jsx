import styles from './FormField.module.scss';

/** @param {{ label: string, hint?: string, error?: string, children: import('react').ReactNode }} props */
export function FormField({ label, hint, error, children }) {
  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      {children}
      {error || hint ? (
        <div className={error ? styles.error : styles.hint}>
          {error || hint}
        </div>
      ) : null}
    </div>
  );
}
