'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  Card,
  Container,
  EmptyState,
  FormField,
  Modal,
  ProgressBar,
  Skeleton,
  TextField,
} from '@/common-components';
import {
  CERTIFICATE_CHECKLIST,
  CERTIFICATE_COPY,
  CERTIFICATE_PRICE,
} from '@/constants/certificate';
import { ROUTES } from '@/constants/routes';
import { VALIDATION } from '@/constants/validation';
import { useTypingStore } from '@/store/use-typing-store';

import styles from './certificate-page.module.scss';

function formatTestDuration(elapsedMs) {
  if (!elapsedMs) return '—';

  return `${Math.round(elapsedMs / 1000)} second`;
}

function CertificatePreview({ name, result }) {
  return (
    <div className={styles.certificate} aria-label="Certificate preview">
      <div className={styles.certificateFrame}>
        <div className={styles.certificateBody}>
          <p className={styles.certificateLabel}>
            {CERTIFICATE_COPY.certificateTitle}
          </p>
          <h2>{name || CERTIFICATE_COPY.previewName}</h2>
          <strong className={styles.certificateScore}>{result.wpm} WPM</strong>
          <p className={styles.certificateMeta}>
            {result.accuracy}% {CERTIFICATE_COPY.accuracy} ·{' '}
            {formatTestDuration(result.elapsedMs)} {CERTIFICATE_COPY.test}
          </p>
        </div>
      </div>
      <div className={styles.certificateFooter}>
        <span>{CERTIFICATE_COPY.resultVerified}</span>
        <span>{CERTIFICATE_COPY.certificateIdOnIssue}</span>
      </div>
    </div>
  );
}

function ClaimChecklist({ hasName }) {
  const completedSteps = CERTIFICATE_CHECKLIST.filter((step) => {
    if (step.key === 'verifiedResult') return true;
    if (step.key === 'name') return hasName;
    return false;
  }).length;

  return (
    <section className={styles.checklist} aria-labelledby="claim-completeness">
      <p id="claim-completeness">{CERTIFICATE_COPY.completeness}</p>
      <ProgressBar
        label={`${completedSteps} of ${CERTIFICATE_CHECKLIST.length} claim steps complete`}
        max={CERTIFICATE_CHECKLIST.length}
        value={completedSteps}
      />
      <ul>
        {CERTIFICATE_CHECKLIST.map((step) => {
          const complete =
            step.key === 'verifiedResult' || (step.key === 'name' && hasName);

          return (
            <li
              className={complete ? styles['checklistItem--complete'] : ''}
              key={step.key}
            >
              <span aria-hidden="true">{complete ? '✓' : ''}</span>
              {step.label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CertificatePage() {
  const result = useTypingStore((state) => state.lastResult);
  const loadLastResult = useTypingStore((state) => state.loadLastResult);
  const [isResultResolved, setIsResultResolved] = useState(false);
  const [name, setName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);

  useEffect(() => {
    loadLastResult();
    setIsResultResolved(true);
  }, [loadLastResult]);

  const hasName = Boolean(name.trim());
  const nameError =
    draftName.trim() &&
    !VALIDATION.certificateNamePattern.test(draftName.trim())
      ? CERTIFICATE_COPY.nameError
      : undefined;
  const testSummary = useMemo(
    () =>
      result
        ? `${result.wpm} WPM · ${result.accuracy}% ${CERTIFICATE_COPY.accuracy}`
        : '',
    [result],
  );

  function openNameDialog() {
    setDraftName(name);
    setIsNameDialogOpen(true);
  }

  function closeNameDialog() {
    setIsNameDialogOpen(false);
  }

  function saveName() {
    const normalizedName = draftName.trim().replace(/\s+/g, ' ');
    if (
      !normalizedName ||
      !VALIDATION.certificateNamePattern.test(normalizedName)
    )
      return;

    setName(normalizedName);
    closeNameDialog();
  }

  if (!isResultResolved) {
    return (
      <div className="page-shell page-shell--subpage">
        <Container>
          <Skeleton height="460px" />
        </Container>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="page-shell page-shell--subpage">
        <Container size="md">
          <EmptyState
            action={
              <Button href={ROUTES.home}>{CERTIFICATE_COPY.takeTest}</Button>
            }
            description={CERTIFICATE_COPY.noResultDescription}
            title={CERTIFICATE_COPY.noResultTitle}
          />
        </Container>
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--subpage">
      <Container>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{CERTIFICATE_COPY.eyebrow}</p>
            <h1>
              {CERTIFICATE_COPY.heading.before}
              <em>{CERTIFICATE_COPY.heading.emphasis}</em>
            </h1>
          </div>
          <Button href={ROUTES.verify} size="lg" variant="secondary">
            {CERTIFICATE_COPY.verifyAction}
          </Button>
        </header>

        <div className={styles.layout}>
          <Card className={styles.claimCard}>
            <p className={styles.cardEyebrow}>
              {CERTIFICATE_COPY.readyToClaim} · {CERTIFICATE_PRICE}
            </p>
            <CertificatePreview name={name} result={result} />
            <div className={styles.claimActions}>
              <Button onClick={openNameDialog} size="lg">
                {CERTIFICATE_COPY.getCertificate}
              </Button>
              <p>{CERTIFICATE_COPY.paymentsOpeningSoon}</p>
            </div>
          </Card>

          <Card className={styles.issuedCard}>
            <p className={styles.cardEyebrow}>{CERTIFICATE_COPY.issued}</p>
            <h2>{CERTIFICATE_COPY.noCertificates}</h2>
            <p className={styles.issuedDescription}>
              {CERTIFICATE_COPY.issuedDescription}
            </p>
            <p className={styles.verifiedResult}>{testSummary}</p>
            <ClaimChecklist hasName={hasName} />
          </Card>
        </div>
      </Container>

      <Modal
        onClose={closeNameDialog}
        open={isNameDialogOpen}
        title={CERTIFICATE_COPY.personalizeTitle}
      >
        <form
          className={styles.nameDialogContent}
          onSubmit={(event) => {
            event.preventDefault();
            saveName();
          }}
        >
          <FormField
            hint={CERTIFICATE_COPY.nameHint}
            label={CERTIFICATE_COPY.nameLabel}
          >
            <TextField
              aria-label={CERTIFICATE_COPY.nameLabel}
              autoComplete="name"
              error={nameError}
              id="certificate-name"
              maxLength={VALIDATION.certificateNameMaxLength}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={CERTIFICATE_COPY.previewName}
              value={draftName}
            />
          </FormField>
          <Button
            disabled={!draftName.trim() || Boolean(nameError)}
            size="lg"
            type="submit"
          >
            {CERTIFICATE_COPY.saveName}
          </Button>
          <p className={styles.dialogNotice}>
            {CERTIFICATE_COPY.paymentNotice}
          </p>
        </form>
      </Modal>
    </div>
  );
}
