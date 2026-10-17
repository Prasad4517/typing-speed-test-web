import styles from './ProgressBar.module.scss';

/** @param {{ value: number, max?: number, label?: string, className?: string }} props */
export function ProgressBar({ value, max = 100, label, className, ...rest }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin="0"
      aria-valuenow={value}
      className={`${styles.track} ${className || ''}`}
      role="progressbar"
      {...rest}
    >
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}
