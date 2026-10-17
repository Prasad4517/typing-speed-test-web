import styles from './Select.module.scss';

/** @param {{ label: string, options: Array<{label:string,value:string|number}>, className?: string }} props */
export function Select({ label, options, id, className, ...rest }) {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label className={`${styles.field} ${className || ''}`} htmlFor={selectId}>
      <span className={styles.label}>{label}</span>
      <select className={styles.select} id={selectId} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
