import styles from './Kbd.module.scss';

/** @param {{ children: import('react').ReactNode }} props */
export function Kbd({ children }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}
