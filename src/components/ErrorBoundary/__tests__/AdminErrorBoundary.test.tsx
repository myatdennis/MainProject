/**
 * AdminErrorBoundary — resetKey tests
 *
 * These tests confirm that:
 *  1. resetKey changes clear error state without unmounting the boundary fiber.
 *  2. This is critical for startTransition deferred navigation: if key= were
 *     used instead of resetKey=, React would unmount the Suspense tree and
 *     the transition deferred rendering would be destroyed.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminErrorBoundary from '../AdminErrorBoundary';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A child that unconditionally throws during render when `shouldThrow=true`. */
const ThrowingChild = ({ shouldThrow, label }: { shouldThrow: boolean; label: string }) => {
  if (shouldThrow) {
    throw new Error(`Test error from ${label}`);
  }
  return <div data-testid="child">{label}</div>;
};

/** Suppress console.error noise from React's error boundary machinery in tests. */
const suppressConsole = () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  return () => { errorSpy.mockRestore(); warnSpy.mockRestore(); };
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <AdminErrorBoundary>
        <div data-testid="child">content</div>
      </AdminErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('shows fallback UI when a child throws', () => {
    const restore = suppressConsole();
    render(
      <AdminErrorBoundary>
        <ThrowingChild shouldThrow label="page-a" />
      </AdminErrorBoundary>,
    );
    // Default fallback contains "Something went wrong"
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    restore();
  });

  it('resets error state when resetKey changes — without unmounting the boundary', () => {
    const restore = suppressConsole();

    // Track mount/unmount of the boundary itself via onError callback
    let errorCaughtCount = 0;
    const onError = () => { errorCaughtCount++; };

    const { rerender } = render(
      <AdminErrorBoundary resetKey="/admin/courses" onError={onError}>
        <ThrowingChild shouldThrow label="page-a" />
      </AdminErrorBoundary>,
    );

    // Boundary should now show the error fallback
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    expect(errorCaughtCount).toBe(1);

    // Navigate: resetKey changes → getDerivedStateFromProps clears error state
    // The boundary is NOT unmounted — the same fiber continues.
    rerender(
      <AdminErrorBoundary resetKey="/admin/dashboard" onError={onError}>
        <ThrowingChild shouldThrow={false} label="page-b" />
      </AdminErrorBoundary>,
    );

    // Error UI should be gone; child renders normally
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByText('page-b')).toBeTruthy();

    // onError was NOT called again (the boundary wasn't remounted)
    expect(errorCaughtCount).toBe(1);
    restore();
  });

  it('does NOT reset error state when resetKey stays the same', () => {
    const restore = suppressConsole();

    const { rerender } = render(
      <AdminErrorBoundary resetKey="/admin/courses">
        <ThrowingChild shouldThrow label="page-a" />
      </AdminErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeTruthy();

    // Same resetKey → getDerivedStateFromProps returns null → error persists
    rerender(
      <AdminErrorBoundary resetKey="/admin/courses">
        <ThrowingChild shouldThrow={false} label="page-a-healed" />
      </AdminErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeTruthy();
    restore();
  });

  it('uses custom fallbackComponent when provided', () => {
    const restore = suppressConsole();
    const CustomFallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <AdminErrorBoundary fallbackComponent={CustomFallback}>
        <ThrowingChild shouldThrow label="page-c" />
      </AdminErrorBoundary>,
    );

    expect(screen.getByTestId('custom-fallback')).toBeTruthy();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    restore();
  });

  it('resets error state when resetKey changes from undefined to a path', () => {
    const restore = suppressConsole();

    const { rerender } = render(
      // No resetKey initially
      <AdminErrorBoundary>
        <ThrowingChild shouldThrow label="broken" />
      </AdminErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeTruthy();

    // Provide a resetKey for the first time → clears error
    rerender(
      <AdminErrorBoundary resetKey="/admin/dashboard">
        <ThrowingChild shouldThrow={false} label="fixed" />
      </AdminErrorBoundary>,
    );

    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    expect(screen.getByText('fixed')).toBeTruthy();
    restore();
  });
});
