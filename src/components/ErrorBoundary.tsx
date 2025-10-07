import React from 'react';

type Props = { children: React.ReactNode };

type State = { hasError: boolean; error?: Error | null };

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Send to logging service if desired
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-4">An error occurred while rendering this admin page. The error has been logged.</p>
            <details className="text-xs text-gray-700 whitespace-pre-wrap">
              {this.state.error?.message}
              {this.state.error?.stack && (<pre className="mt-2 text-xs text-gray-600">{this.state.error.stack}</pre>)}
            </details>
            <div className="mt-4">
              <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-4 py-2 rounded">Reload</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

export default ErrorBoundary;
