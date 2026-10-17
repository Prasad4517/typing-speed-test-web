import styles from './Divider.module.scss';

/** @param {{ orientation?: 'horizontal'|'vertical', className?: string }} props */
export function Divider({ orientation = 'horizontal', className, ...rest }) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.divider} ${styles[`divider--${orientation}`]} ${className || ''}`}
      {...rest}
    />
  );
}
