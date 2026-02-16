import React from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  surface?: 'admin' | 'lms';
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Unhandled runtime error', {
      error,
      info,
      surface: this.props.surface ?? 'admin',
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const showStack = Boolean(import.meta.env?.DEV && this.state.error?.stack);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-10 text-center">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
          <div className="mb-4 flex items-center justify-center text-amber-500">
            <AlertTriangle className="h-10 w-10" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            The admin portal hit an unexpected error. Your draft content stays safe. Reload the page to continue or
            reach out to Huddle support if the issue persists.
          </p>
          {showStack && (
            <pre className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-slate-950/5 p-3 text-left text-xs text-slate-700">
              {this.state.error?.stack}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal/90"
          >
            Reload Admin Portal
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
