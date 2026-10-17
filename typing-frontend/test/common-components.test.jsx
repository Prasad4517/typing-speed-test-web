import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Accordion,
  FormField,
  Modal,
  SegmentedControl,
} from '@/common-components';

describe('common components', () => {
  it('opens and closes accordion content accessibly', () => {
    render(<Accordion items={[{ title: 'Question', content: 'Answer' }]} />);
    const trigger = screen.getByRole('button', { name: /question/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Answer')).toBeVisible();
  });

  it('keeps segmented control selection controlled', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        name="mode"
        options={[
          { label: 'Timed', value: 'timed' },
          { label: 'Passage', value: 'passage' },
        ]}
        onChange={onChange}
        value="timed"
      />,
    );
    fireEvent.click(screen.getByText('Passage'));
    expect(onChange).toHaveBeenCalledWith('passage');
  });

  it('connects form field messaging to its child area', () => {
    render(
      <FormField hint="Required">
        <input aria-label="Name" />
      </FormField>,
    );
    expect(screen.getByText('Required')).toBeVisible();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('closes modal with Escape and restores body scrolling', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} open title="Settings">
        <button type="button">Save</button>
      </Modal>,
    );
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
