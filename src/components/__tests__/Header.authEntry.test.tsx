import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header';

vi.mock('../../context/SecureAuthContext', () => ({
  useSecureAuth: () => ({
    user: null,
    isAuthenticated: { admin: false, lms: false },
    authInitializing: false,
    logout: vi.fn(),
  }),
}));

describe('Header auth entry simplification', () => {
  it('shows only one login action for logged-out visitors', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Client Login/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Admin Portal/i })).not.toBeInTheDocument();
  });
});
