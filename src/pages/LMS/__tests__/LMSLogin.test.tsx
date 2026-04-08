import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { RuntimeStatus } from '../../../state/runtimeStatus';
import LMSLogin from '../LMSLogin';
import { MemoryRouter } from 'react-router-dom';

const defaultRuntimeStatus: RuntimeStatus = {
  supabaseConfigured: false,
  supabaseHealthy: false,
  apiHealthy: true,
  apiReachable: true,
  apiAuthRequired: false,
  wsEnabled: false,
  demoModeEnabled: true,
  offlineQueueBacklog: 0,
  storageStatus: 'unknown',
  statusLabel: 'demo-fallback',
  lastChecked: null,
  requestId: null,
  errorType: null,
  lastError: undefined,
};

let currentRuntimeStatus: RuntimeStatus = { ...defaultRuntimeStatus };
const mockRuntimeStatus = vi.fn(() => currentRuntimeStatus);
const mockNavigate = vi.fn();

vi.mock('../../../hooks/useRuntimeStatus', () => ({
  __esModule: true,
  default: () => mockRuntimeStatus(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuth = {
  login: vi.fn().mockResolvedValue({ success: true }),
  register: vi.fn().mockResolvedValue({ success: true }),
  forgotPassword: vi.fn().mockResolvedValue(true),
  isAuthenticated: { lms: false, admin: false },
};

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => mockAuth,
}));

describe('LMSLogin runtime awareness', () => {
  const renderScreen = () =>
    render(
      <MemoryRouter>
        <LMSLogin />
      </MemoryRouter>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    currentRuntimeStatus = { ...defaultRuntimeStatus };
  });

  it('disables registration while in demo mode', () => {
    renderScreen();

    expect(screen.getByText(/Demo mode active/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Create Account tab/i })).toBeDisabled();
  });

  it('enables registration when Supabase is healthy', () => {
    currentRuntimeStatus = {
      ...defaultRuntimeStatus,
      supabaseConfigured: true,
      supabaseHealthy: true,
      demoModeEnabled: false,
      statusLabel: 'ok',
      lastChecked: Date.now(),
    };

    renderScreen();

    expect(screen.getByText(/Secure mode connected/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Create Account tab/i })).not.toBeDisabled();
  });

  it('shows a helpful message when forgot password is clicked offline', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Forgot password/i }));

    expect(
      await screen.findByText(/Password reset is unavailable while the platform is in demo or maintenance mode/i),
    ).toBeInTheDocument();
  });

  it('defaults to client login mode', () => {
    renderScreen();

    expect(screen.getByRole('tab', { name: /Client Login/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Admin Login/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to admin mode and signs in through admin auth path', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('tab', { name: /Admin Login/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Admin Portal/i }));

    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith('user@pacificcoast.edu', 'user123', 'admin');
      expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
    });
  });

  it('keeps client login redirect pointed to learner dashboard', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith('user@pacificcoast.edu', 'user123', 'lms');
      expect(mockNavigate).toHaveBeenCalledWith('/lms/dashboard', { replace: true });
    });
  });
});
