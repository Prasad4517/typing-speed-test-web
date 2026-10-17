import styles from './SegmentedControl.module.scss';

/** @param {{ label?: string, options: Array<{label:string,value:string|number}>, value: string|number, onChange: Function, name?: string }} props */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  name = 'segment',
}) {
  return (
    <fieldset className={styles.fieldset}>
      {label ? <legend className={styles.legend}>{label}</legend> : null}
      <div className={styles.control}>
        {options.map((option) => (
          <label
            className={`${styles.option} ${value === option.value ? styles.active : ''}`}
            key={option.value}
          >
            <input
              checked={value === option.value}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
