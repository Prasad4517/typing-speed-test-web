import styles from './Skeleton.module.scss';

/** @param {{ width?: string, height?: string, className?: string }} props */
export function Skeleton({
  width = '100%',
  height = '16px',
  className,
  ...rest
}) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.skeleton} ${className || ''}`}
      style={{ width, height }}
      {...rest}
    />
  );
}
