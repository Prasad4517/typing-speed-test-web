import styles from './VisuallyHidden.module.scss';

/** @param {{ children: import('react').ReactNode }} props */
export function VisuallyHidden({ children, ...rest }) {
  return (
    <span className={styles.hidden} {...rest}>
      {children}
    </span>
  );
}
