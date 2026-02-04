import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import serviceWorkerManager from './utils/ServiceWorkerManager';
import { SecureAuthProvider } from './context/SecureAuthContext';
import { ToastProvider } from './context/ToastContext';
import { ensureRuntimeStatusPolling } from './state/runtimeStatus';
import { migrateFromLocalStorage, checkStorageSecurity, installLocalStorageGuards } from './lib/secureStorage';
import { getApiBaseUrl } from './config/apiBase';
import { registerApiNavigationGuard } from './utils/apiNavigationGuard';
import { toast } from 'react-hot-toast';
import { startSupabaseLogin } from './utils/startSupabaseLogin';

const devConsole = {
  log: (...args: unknown[]) => {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },
};

devConsole.log('🚀 MainProject App initializing...');
devConsole.log('📍 Environment:', import.meta.env.MODE);
devConsole.log('🔧 Supabase configured:', !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));
devConsole.log('⚙️ React version detected:', React?.version || 'unknown');
devConsole.info('[api] Base URL resolved:', getApiBaseUrl() || '(not set)');

if (typeof window !== 'undefined') {
  try {
    migrateFromLocalStorage();
    installLocalStorageGuards();
    checkStorageSecurity();
  } catch (error) {
    console.warn('[secureStorage] bootstrap migration failed:', error);
  }

  if (import.meta.env.DEV) {
    registerApiNavigationGuard();

    const globalScope = window as typeof window & { __fetchDebugPatched?: boolean };
    const fetchDebugEnabled = Boolean((window as any).__FETCH_DEBUG__);
    if (import.meta.env.DEV && fetchDebugEnabled && !globalScope.__fetchDebugPatched && typeof window.fetch === 'function') {
      const originalFetch = window.fetch.bind(window);
      const toPathOnly = (input: string): string => {
        try {
          const url = new URL(input, window.location.origin);
          return url.pathname;
        } catch {
          return input.split('?')[0] ?? input;
        }
      };

      globalScope.__fetchDebugPatched = true;
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!(import.meta.env.DEV && (window as any).__FETCH_DEBUG__)) {
          return originalFetch(input as any, init as any);
        }

        const start = performance.now();
        const urlString =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.toString()
            : typeof Request !== 'undefined' && input instanceof Request
            ? input.url
            : String(input);
        const method =
          init?.method ||
          (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');

        const response = await originalFetch(input as any, init as any);
        const duration = performance.now() - start;

        const pathname = toPathOnly(urlString);
        console.debug('[fetch-debug]', {
          method,
          url: pathname,
          status: response.status,
          durationMs: Math.round(duration),
        });

        return response;
      };
    }
  }
}

class SecureAuthErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SecureAuthErrorBoundary] Caught error', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoToLogin = () => {
    void startSupabaseLogin();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = Boolean(import.meta.env?.DEV);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '32px' }}>
        <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 15px 45px rgba(15,23,42,0.12)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: 16 }}>
            We couldn’t load secure session data. Please reload the page or return to the login screen.
          </p>
          {isDev && this.state.error && (
            <pre style={{ background: '#f1f5f9', padding: 12, borderRadius: 8, fontSize: '0.8rem', color: '#0f172a', maxHeight: 180, overflow: 'auto', marginBottom: 16 }}>
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#0f172a', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.handleGoToLogin}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#e2e8f0', color: '#0f172a', fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

const rootElement = document.getElementById('root');

ensureRuntimeStatusPolling();

if (!rootElement) {
  console.error('❌ Root element not found! Cannot render app.');
  document.body.innerHTML = '<div style="padding: 40px; font-family: system-ui; color: #D72638;"><h1>Error: Root Element Missing</h1><p>The #root div is missing from index.html</p></div>';
} else {
  devConsole.log('✅ Root element found, rendering app...');
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <SecureAuthErrorBoundary>
            <SecureAuthProvider>
              <ToastProvider>
                <HelmetProvider>
                  <App />
                </HelmetProvider>
              </ToastProvider>
            </SecureAuthProvider>
          </SecureAuthErrorBoundary>
        </QueryClientProvider>
      </StrictMode>
    );
    devConsole.log('✅ App rendered successfully');
  } catch (error) {
    console.error('❌ Error rendering app:', error);
  rootElement.innerHTML = `<div style="padding: 40px; font-family: system-ui; color: #D72638;"><h1>Error Rendering App</h1><pre>${error}</pre></div>`;
  }
}

const showServiceWorkerUpdateToast = (registration: ServiceWorkerRegistration) => {
  toast.custom((t) => (
    <div className="bg-charcoal text-white px-4 py-3 rounded shadow-lg flex flex-col gap-2 w-80">
      <div>
        <p className="text-sm font-semibold">Update available</p>
        <p className="text-xs text-white/80">Refresh to load the newest improvements.</p>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          className="px-3 py-1 text-sm rounded border border-white/40 text-white hover:bg-white/10"
          onClick={() => toast.dismiss(t.id)}
        >
          Later
        </button>
        <button
          className="px-3 py-1 text-sm rounded bg-sunrise text-charcoal font-semibold"
          onClick={() => {
            toast.dismiss(t.id);
            serviceWorkerManager.applyUpdate(registration);
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  ), { duration: 10000, position: 'bottom-right' });
};

const showServiceWorkerErrorToast = () => {
  toast.custom((t) => (
    <div className="bg-white text-charcoal px-4 py-3 rounded shadow-lg border border-slate flex flex-col gap-2 w-80">
      <div>
        <p className="text-sm font-semibold">Offline cache issue</p>
        <p className="text-xs text-gray">Refreshing usually fixes this. Need help? Tap Troubleshoot.</p>
      </div>
      <div className="flex gap-3 items-center justify-end">
        <a
          className="text-xs text-skyblue underline"
          href="https://support.the-huddle.co/offline-troubleshoot"
          target="_blank"
          rel="noreferrer"
        >
          Troubleshoot
        </a>
        <button
          className="px-3 py-1 text-sm rounded bg-charcoal text-white"
          onClick={() => {
            toast.dismiss(t.id);
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    </div>
  ), { duration: 12000, position: 'bottom-right' });
};

const supportsServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
const serviceWorkerEnabled =
  supportsServiceWorker && import.meta.env.PROD && import.meta.env.VITE_ENABLE_SW !== 'false';

if (serviceWorkerEnabled) {
  console.log('📦 Production mode: Registering service worker...');
  serviceWorkerManager.register({
    onSuccess: () => {
      console.log('✅ Admin portal is ready for offline use');
    },
    onUpdate: (registration) => {
      console.log('🔄 New version available');
      showServiceWorkerUpdateToast(registration);
    },
    onOfflineReady: () => {
      console.log('💾 Admin portal cached for offline use');
    },
    onError: () => {
      showServiceWorkerErrorToast();
    },
  });

  serviceWorkerManager.setupNetworkMonitoring();
} else {
  console.log('🛠️ Service worker disabled for this build');
  serviceWorkerManager.forceCleanup().catch((error) => {
    console.warn('[SW] Failed to perform cleanup:', error);
  });
}
