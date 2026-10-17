import styles from './Spinner.module.scss';

/** @param {{ size?: 'sm'|'md', label?: string }} props */
export function Spinner({ size = 'md', label = 'Loading' }) {
  return (
    <span
      aria-label={label}
      className={`${styles.spinner} ${styles[`spinner--${size}`]}`}
      role="status"
    />
  );
}
