import { cn } from '@/utils/cn';
import styles from './Table.module.scss';

/** @param {{ columns: Array<{key:string,label:string}>, rows: Array<Record<string,any>>, empty?: import('react').ReactNode, tone?: 'default'|'dark', className?: string }} props */
export function Table({
  columns,
  rows,
  empty = 'No records yet.',
  tone = 'default',
  className,
}) {
  const toneClassName = styles[`tone--${tone}`];

  if (!rows.length)
    return (
      <div className={cn(styles.empty, toneClassName, className)}>{empty}</div>
    );

  return (
    <div
      className={cn(styles.wrapper, toneClassName, className)}
      role="region"
      tabIndex="0"
    >
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.testId || rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
