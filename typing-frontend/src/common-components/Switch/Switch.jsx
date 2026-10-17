import styles from './Switch.module.scss';

/** @param {{ label: import('react').ReactNode, checked?: boolean, onChange?: Function }} props */
export function Switch({ label, ...rest }) {
  return (
    <label className={styles.switch}>
      <input role="switch" type="checkbox" {...rest} />
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      <span>{label}</span>
    </label>
  );
}
