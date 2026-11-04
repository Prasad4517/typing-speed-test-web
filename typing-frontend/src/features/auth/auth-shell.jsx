'use client';

import { motion, useReducedMotion } from 'motion/react';

import { Container } from '@/common-components';
import { Logo } from '@/common-components/Logo';
import { cn } from '@/utils/cn';

import styles from './auth-shell.module.scss';

const KEYCAPS = Object.freeze(['W', 'P', 'M', '↗']);

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  className,
  compact = false,
}) {
  const reduceMotion = useReducedMotion();
  // Keep server-rendered forms visible before hydration. Decorative motion is
  // layered on separately so authentication never depends on animation JS.
  const enter = { initial: false };

  return (
    <div className={cn(styles.page, className)}>
      <div aria-hidden="true" className={styles.ambient}>
        <span />
        <span />
        <span />
      </div>
      <Container className={styles.container} size="lg">
        <motion.section className={styles.story} {...enter}>
          <div className={styles.storyTop}>
            <Logo />
            <span className={styles.liveBadge}>
              <i /> progress sync is on
            </span>
          </div>

          <div className={styles.storyCopy}>
            <p className={styles.miniLabel}>Your daily typing glow-up</p>
            <h2>
              Type fast.
              <br />
              <em>Level up.</em>
            </h2>
            <p>
              Save every personal best, keep your streak alive, and turn small
              practice sessions into serious speed.
            </p>
          </div>

          <div className={styles.typeCard}>
            <div className={styles.typeCardMeta}>
              <span>live practice</span>
              <strong>01:00</strong>
            </div>
            <p>
              <span>small steps become </span>
              <mark>big speed</mark>
              <b aria-hidden="true" />
            </p>
            <div className={styles.typeStats}>
              <span>
                <strong>84</strong> WPM
              </span>
              <span>
                <strong>98%</strong> accuracy
              </span>
              <span className={styles.spark}>+12 this week</span>
            </div>
          </div>

          <div aria-hidden="true" className={styles.keycaps}>
            {KEYCAPS.map((key, index) => (
              <motion.span
                animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
                key={key}
                transition={{
                  delay: index * 0.15,
                  duration: 2.8 + index * 0.15,
                  ease: 'easeInOut',
                  repeat: Infinity,
                }}
              >
                {key}
              </motion.span>
            ))}
          </div>
        </motion.section>

        <motion.section
          className={cn(styles.panel, compact && styles.compact)}
          {...enter}
        >
          <header className={styles.heading}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          {children}
          <p className={styles.privacyNote}>
            Protected by secure, cookie-based session recovery. Access tokens
            never touch browser storage.
          </p>
        </motion.section>
      </Container>
    </div>
  );
}
