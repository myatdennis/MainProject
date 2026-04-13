import type { ReactNode } from 'react';
import { logAuthRedirect } from '../utils/logAuthRedirect';
import { isLoginPath, resolveLoginPath } from '../utils/surface';

export const renderAuthState = ({
  authStatus,
  authInitializing,
  bootstrapError,
  onRetry,
  onGoToLogin,
  children,
  shouldRedirectToLogin,
}: {
  authStatus: 'booting' | 'authenticated' | 'unauthenticated' | 'error';
  authInitializing: boolean;
  bootstrapError: string | null;
  onRetry: () => void;
  onGoToLogin: () => void;
  children: ReactNode;
  shouldRedirectToLogin: boolean;
}) => {
  const pathname =
    typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
  const isAuthenticatedUser = authStatus === 'authenticated';
  const isPublicAuthPath =
    isLoginPath(pathname) ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/invite/');
  const isMarketingLanding = pathname === '/';
  const isProtectedAppRoute = /^\/(admin|lms|client)(?:\/|$)/i.test(pathname);

  if (authStatus === 'booting') {
    if (isProtectedAppRoute && !isPublicAuthPath) {
      return <>{children}</>;
    }
    return <BootstrapLoading />;
  }

  const shouldBypassErrorOverlay = authStatus === 'error' && isPublicAuthPath;

  if (bootstrapError && authStatus !== 'authenticated') {
    return (
      <BootstrapErrorOverlay
        message={bootstrapError}
        onRetry={onRetry}
        onGoToLogin={onGoToLogin}
      />
    );
  }

  if (authStatus === 'error' && !shouldBypassErrorOverlay) {
    return (
      <BootstrapErrorOverlay
        message={bootstrapError || 'We could not restore your session. Please try again.'}
        onRetry={onRetry}
        onGoToLogin={onGoToLogin}
      />
    );
  }

  if (authStatus === 'error' && shouldBypassErrorOverlay) {
    return <>{children}</>;
  }

  if (authStatus === 'unauthenticated') {
    if (!isAuthenticatedUser && (isPublicAuthPath || isMarketingLanding)) {
      return <>{children}</>;
    }
    if (authInitializing) {
      console.debug('[AUTH REDIRECT DECISION]', {
        decision: 'suppressed_bootstrap_in_progress',
        authStatus,
        authInitializing,
        shouldRedirectToLogin,
        pathname,
        ts: Date.now(),
      });
      if (isProtectedAppRoute && !isPublicAuthPath) return <>{children}</>;
      return <BootstrapLoading />;
    }
    const onLoginRoute = isLoginPath();
    if (!onLoginRoute && shouldRedirectToLogin) {
      if (typeof window !== 'undefined') {
        const target = resolveLoginPath();
        console.debug('[AUTH REDIRECT DECISION]', {
          decision: 'redirecting',
          authStatus,
          authInitializing,
          shouldRedirectToLogin,
          pathname,
          target,
          ts: Date.now(),
        });
        logAuthRedirect('SecureAuthContext.renderAuthState.unauthenticated', {
          target,
          pathname,
        });
        window.location.assign(target);
      }
      return <BootstrapRedirecting message="Redirecting to login…" />;
    }
    return <BootstrapUnauthenticated onGoToLogin={onGoToLogin} />;
  }

  return children;
};

const BootstrapErrorOverlay = ({
  message,
  onRetry,
  onGoToLogin,
}: {
  message: string;
  onRetry: () => void;
  onGoToLogin: () => void;
}) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-6 shadow-lg">
      <div className="flex items-center gap-2 text-red-600">
        <span className="text-base font-semibold uppercase tracking-wide">Session Error</span>
      </div>
      <p className="mt-4 text-sm text-gray-700" role="alert">
        {message}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
          onClick={onRetry}
        >
          Retry
        </button>
        <button
          type="button"
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          onClick={onGoToLogin}
        >
          Go to login
        </button>
      </div>
    </div>
  </div>
);

const BootstrapLoading = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-mist bg-white px-10 py-8 shadow-lg">
      <span className="text-sm font-semibold uppercase tracking-wide text-slate">Initializing session</span>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-cloud border-t-sunrise" aria-label="Loading" />
      <p className="text-center text-sm text-slate/70">Please hold while we verify your access…</p>
    </div>
  </div>
);

const BootstrapRedirecting = ({ message }: { message: string }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-mist bg-white px-10 py-8 shadow-lg">
      <span className="text-sm font-semibold uppercase tracking-wide text-slate">Redirecting</span>
      <p className="text-center text-sm text-slate/70">{message}</p>
    </div>
  </div>
);

const BootstrapUnauthenticated = ({ onGoToLogin }: { onGoToLogin: () => void }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
    <div className="w-full max-w-lg rounded-2xl border border-mist bg-white p-6 text-center shadow-lg">
      <p className="text-base font-semibold text-charcoal">Please log in</p>
      <p className="mt-2 text-sm text-slate/70">To continue, sign in again.</p>
      <button
        type="button"
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-charcoal px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-charcoal/90"
        onClick={onGoToLogin}
      >
        Go to login
      </button>
    </div>
  </div>
);
