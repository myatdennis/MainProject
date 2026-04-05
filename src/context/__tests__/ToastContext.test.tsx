import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../ToastContext';

const ToastHarness = () => {
  const { showToast } = useToast();

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          showToast('First message', 'info', 10000);
          showToast('Second message', 'warning', 10000);
        }}
      >
        Add pair
      </button>
      <button
        type="button"
        onClick={() => {
          for (let index = 1; index <= 5; index += 1) {
            showToast(`Toast ${index}`, 'info', 10000);
          }
        }}
      >
        Add many
      </button>
    </div>
  );
};

describe('ToastProvider', () => {
  it('queues multiple toasts instead of replacing the previous one', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add pair' }));

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss notification' });
    await user.click(dismissButtons[0]);

    expect(screen.queryByText('First message')).not.toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });

  it('keeps only the most recent toast messages when stack exceeds max size', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Add many' }));

    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 2')).toBeInTheDocument();
    expect(screen.getByText('Toast 5')).toBeInTheDocument();
  });
});
