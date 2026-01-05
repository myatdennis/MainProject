import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RuntimeStatus } from '../../../state/runtimeStatus';
import LMSLogin from '../LMSLogin';
import { MemoryRouter } from 'react-router-dom';

const defaultRuntimeStatus: RuntimeStatus = {
  supabaseConfigured: false,
  supabaseHealthy: false,
  apiHealthy: true,
  demoModeEnabled: true,
  offlineQueueBacklog: 0,
  storageStatus: 'unknown',
  statusLabel: 'demo-fallback',
  lastChecked: null,
  requestId: null,
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
  isAuthenticated: { lms: false },
};

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockAuth,
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
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: /Create Account/i })).not.toBeDisabled();
  });

  it('shows a helpful message when forgot password is clicked offline', async () => {
    renderScreen();

    fireEvent.click(screen.getByRole('button', { name: /Forgot password/i }));

    expect(
      await screen.findByText(/Password reset is unavailable while the platform is in demo or maintenance mode/i),
    ).toBeInTheDocument();
  });
});
