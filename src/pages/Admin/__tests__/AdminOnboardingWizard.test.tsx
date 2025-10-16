import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../context/ToastContext';
import { AuthProvider } from '../../../context/AuthContext';
import AdminOnboardingWizard from '../AdminOnboardingWizard';

const renderWizard = () =>
  render(
    <MemoryRouter initialEntries={['/admin/onboarding/new-org']} initialIndex={0}>
      <AuthProvider>
        <ToastProvider>
          <AdminOnboardingWizard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );

describe('AdminOnboardingWizard', () => {
  it('renders the first step by default', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: 'Organization Details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Organization Name *')).toBeInTheDocument();
  });

  it('progresses through steps when Continue is clicked and required fields are filled', async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText('Organization Name *'), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText('Primary Contact Name *'), { target: { value: 'Jordan Lee' } });
    fireEvent.change(screen.getByLabelText('Primary Contact Email *'), { target: { value: 'jordan@example.com' } });

    fireEvent.click(screen.getByText('Continue'));
    expect(await screen.findByRole('heading', { name: 'Branding' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Continue'));
    expect(await screen.findByRole('heading', { name: 'Default Settings' })).toBeInTheDocument();
  });

  it('prevents navigation when required fields are missing', async () => {
    renderWizard();
    fireEvent.click(screen.getByText('Continue'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Organization Details' })).toBeInTheDocument();
      expect(screen.getByText('Organization name is required.')).toBeInTheDocument();
    });
  });
});
