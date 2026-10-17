import { Container } from '@/common-components';
import { TypingTest } from '@/features/typing-test';
import { HOME_COPY, HOME_STEPS } from './home.constants';
import styles from './home-page.module.scss';

export function HomePage() {
  return (
    <div className={styles.page}>
      <Container className={styles.container}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>{HOME_COPY.eyebrow}</p>
            <h1 className={styles.title}>
              {HOME_COPY.title.before} <em>{HOME_COPY.title.emphasis}</em>{' '}
              {HOME_COPY.title.after}
            </h1>
          </div>
          <p className={styles.description}>{HOME_COPY.description}</p>
        </section>

        <div className={styles.test} id="typing-test">
          <TypingTest />
        </div>
        <section className={styles.steps} aria-label="How Keystroke works">
          {HOME_STEPS.map((step) => (
            <article className={styles.step} key={step.number}>
              <span>{step.number}</span>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
            </article>
          ))}
        </section>
      </Container>
    </div>
  );
}
