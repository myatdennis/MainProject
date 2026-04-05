import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import Modal from '../Modal';

const ModalHarness = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  <div>
    <button type="button">Trigger</button>
    <Modal isOpen={isOpen} onClose={onClose} title="Accessibility test modal">
      <p>Modal body content</p>
      <button type="button">First action</button>
      <button type="button">Second action</button>
    </Modal>
  </div>
);

const StatefulModalHarness = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Trigger
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Accessibility test modal">
        <p>Modal body content</p>
        <button type="button">First action</button>
        <button type="button">Second action</button>
      </Modal>
    </div>
  );
};

describe('Modal', () => {
  it('renders an accessible dialog with title/body relationships', () => {
    render(<ModalHarness isOpen onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog', { name: 'Accessibility test modal' });
    const heading = screen.getByRole('heading', { name: 'Accessibility test modal' });

    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-labelledby', heading.getAttribute('id') ?? '');
    expect(dialog).toHaveAttribute('aria-describedby');
  });

  it('traps keyboard focus inside the modal and restores focus after close', async () => {
    const user = userEvent.setup();
    render(<StatefulModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    await user.click(trigger);

    const firstAction = screen.getByRole('button', { name: 'First action' });
    const secondAction = screen.getByRole('button', { name: 'Second action' });
    firstAction.focus();

    await user.tab();
    expect(secondAction).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Trigger' })).toHaveFocus();
  });
});
