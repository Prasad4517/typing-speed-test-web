'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Card, Container, TextField } from '@/common-components';
import { ROUTES } from '@/constants/routes';
import styles from './verify-page.module.scss';

export function VerifyPage() {
  const [certificateId, setCertificateId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(Boolean(certificateId.trim()));
  }

  return (
    <div className="page-shell page-shell--subpage">
      <Container size="md">
        <section className={styles.heading}>
          <p className="kicker">Public verification</p>
          <h1>
            Check a <em>certificate.</em>
          </h1>
          <p>
            Enter the certificate ID printed on the document. A real certificate
            will always match a record in Keystroke’s verification service.
          </p>
        </section>

        <Card className={styles.verifyCard}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <TextField
              hint="Example: KS7M-4Q9X-2HTD"
              label="Certificate ID"
              maxLength={32}
              onChange={(event) => {
                setCertificateId(event.target.value.toUpperCase());
                setSubmitted(false);
              }}
              placeholder="Enter certificate ID"
              value={certificateId}
            />
            <Button disabled={!certificateId.trim()} size="lg" type="submit">
              Verify certificate →
            </Button>
          </form>

          {submitted ? (
            <div className={styles.pending} role="status">
              <span className={styles.pendingIcon}>!</span>
              <div>
                <strong>Verification API is being connected.</strong>
                <p>
                  The certificate service is not enabled yet, so this ID has not
                  been marked valid or invalid. This prevents the UI from showing
                  an unverified result.
                </p>
              </div>
            </div>
          ) : null}
        </Card>

        <section className={styles.trust}>
          <div>
            <span>01</span>
            <h2>Unique ID</h2>
            <p>Every paid certificate receives its own non-guessable identifier.</p>
          </div>
          <div>
            <span>02</span>
            <h2>Server record</h2>
            <p>Verification will read the official record, not trust edited documents.</p>
          </div>
          <div>
            <span>03</span>
            <h2>Clear result</h2>
            <p>Names, speed, accuracy, and test time must match the issued record.</p>
          </div>
        </section>

        <p className={styles.backLink}>
          Want your own certificate?{' '}
          <Link href={ROUTES.home}>Take a verified typing test.</Link>
        </p>
      </Container>
    </div>
  );
}
