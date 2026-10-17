import styles from './Checkbox.module.scss';

/** @param {{ label: import('react').ReactNode, checked?: boolean, onChange?: Function, className?: string }} props */
export function Checkbox({ label, className, ...rest }) {
  return (
    <label className={`${styles.checkbox} ${className || ''}`}>
      <input type="checkbox" {...rest} />
      <span className={styles.box} aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
