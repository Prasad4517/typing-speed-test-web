import styles from './Tooltip.module.scss';

/** @param {{ label: string, children: import('react').ReactNode }} props */
export function Tooltip({ label, children }) {
  return (
    <span className={styles.wrapper}>
      <span aria-hidden="true" className={styles.tip}>
        {label}
      </span>
      {children}
    </span>
  );
}
