import { Button } from '../Button';
import styles from './ErrorState.module.scss';

/** @param {{ message?: string, onRetry?: Function }} props */
export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
}) {
  return (
    <section className={styles.error} role="alert">
      <p>{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} size="sm">
          Try again
        </Button>
      ) : null}
    </section>
  );
}
