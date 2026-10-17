import styles from './Alert.module.scss';

/** @param {{ children: import('react').ReactNode, tone?: 'info'|'success'|'warning'|'danger', title?: string }} props */
export function Alert({ children, tone = 'info', title }) {
  return (
    <div
      className={`${styles.alert} ${styles[`alert--${tone}`]}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {title ? <strong>{title}</strong> : null}
      <span>{children}</span>
    </div>
  );
}
