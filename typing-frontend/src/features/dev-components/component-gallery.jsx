'use client';

import { useState } from 'react';

import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  FormField,
  Grid,
  Icon,
  IconButton,
  Kbd,
  Modal,
  ProgressBar,
  Select,
  SegmentedControl,
  Skeleton,
  Spinner,
  Stack,
  StatCard,
  Switch,
  Table,
  TextField,
  Tooltip,
} from '@/common-components';
import { TEST_DURATIONS } from '@/constants/test-config';

export function ComponentGallery() {
  const [modalOpen, setModalOpen] = useState(false);
  const [segment, setSegment] = useState('timed');
  const [checked, setChecked] = useState(false);
  return (
    <div className="page-shell page-shell--subpage">
      <div className="shell">
        <p className="kicker">Development only</p>
        <h1>
          Component <em>gallery.</em>
        </h1>
        <p className="hero-intro__description">
          The shared UI primitives used across the product. This route is not
          available in production.
        </p>
        <Divider />
        <section className="gallery-section">
          <h2>Actions and navigation</h2>
          <Stack>
            <div className="gallery-row">
              <Button>Primary action</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <IconButton label="Close">
                <Icon name="close" />
              </IconButton>
              <Kbd>Tab</Kbd>
            </div>
            <div className="gallery-row">
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success">Verified</Badge>
              <Badge tone="danger">Rejected</Badge>
              <Tooltip label="Helpful context">
                <Button variant="secondary">Hover me</Button>
              </Tooltip>
            </div>
          </Stack>
        </section>
        <section className="gallery-section">
          <h2>Forms</h2>
          <Grid columns={2}>
            <TextField
              label="Certificate name"
              placeholder="Your name"
              hint="This will appear on the certificate."
            />
            <Select
              label="Difficulty"
              options={[
                { label: 'Easy', value: 'easy' },
                { label: 'Medium', value: 'medium' },
                { label: 'Hard', value: 'hard' },
              ]}
            />
            <FormField label="Terms">
              <Checkbox
                checked={checked}
                label="I agree to the terms."
                onChange={(event) => setChecked(event.target.checked)}
              />
            </FormField>
            <Switch label="Show live stats" />
            <SegmentedControl
              label="Test mode"
              name="gallery-mode"
              onChange={setSegment}
              options={[
                { label: 'Timed', value: 'timed' },
                { label: 'Passage', value: 'passage' },
              ]}
              value={segment}
            />
          </Grid>
        </section>
        <section className="gallery-section">
          <h2>Feedback and surfaces</h2>
          <Grid columns={2}>
            <Alert title="Ready">Your session is ready.</Alert>
            <Alert title="Careful" tone="warning">
              This action cannot be undone.
            </Alert>
            <Card>
              <Stack>
                <strong>Surface card</strong>
                <p>Reusable content surface with tokenized spacing.</p>
                <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              </Stack>
            </Card>
            <Card tone="dark">
              <Stack>
                <strong>Dark surface</strong>
                <ProgressBar label="Progress" value={72} />
                <Skeleton height="14px" />
                <Spinner />
              </Stack>
            </Card>
          </Grid>
        </section>
        <section className="gallery-section">
          <h2>Data and empty states</h2>
          <Grid columns={2}>
            <StatCard
              detail="verified sessions"
              label="Best WPM"
              value="72.4"
            />
            <EmptyState
              description="Complete a test to see your history here."
              title="No sessions yet"
            />
            <Table
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'score', label: 'Score' },
              ]}
              rows={[{ id: 'one', name: 'Practice session', score: '72 WPM' }]}
            />
          </Grid>
        </section>
        <section className="gallery-section">
          <h2>Disclosure</h2>
          <Accordion
            items={[
              {
                title: 'Why are these components shared?',
                content:
                  'Common behavior and accessibility stay consistent when each primitive is built once.',
              },
              {
                title: 'How do I add a component?',
                content:
                  'Create a folder, keep the component presentational, add a module stylesheet, and export it from the library index.',
              },
            ]}
          />
        </section>
        <Modal
          onClose={() => setModalOpen(false)}
          open={modalOpen}
          title="Shared modal"
        >
          <p>
            Focus is trapped here, Escape closes it, and body scrolling is
            locked while open.
          </p>
          <Button onClick={() => setModalOpen(false)}>Done</Button>
        </Modal>
      </div>
    </div>
  );
}
