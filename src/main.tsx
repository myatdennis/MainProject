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

console.log('🚀 MainProject App initializing...');
console.log('📍 Environment:', import.meta.env.MODE);
console.log('🔧 Supabase configured:', !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));
console.log('⚙️ React version detected:', React?.version || 'unknown');

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
  console.log('✅ Root element found, rendering app...');
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <SecureAuthProvider>
            <ToastProvider>
              <HelmetProvider>
                <App />
              </HelmetProvider>
            </ToastProvider>
          </SecureAuthProvider>
        </QueryClientProvider>
      </StrictMode>
    );
    console.log('✅ App rendered successfully');
  } catch (error) {
    console.error('❌ Error rendering app:', error);
  rootElement.innerHTML = `<div style="padding: 40px; font-family: system-ui; color: #D72638;"><h1>Error Rendering App</h1><pre>${error}</pre></div>`;
  }
}

if (import.meta.env.PROD) {
  console.log('📦 Production mode: Registering service worker...');
  serviceWorkerManager.register({
    onSuccess: () => {
      console.log('✅ Admin portal is ready for offline use');
    },
    onUpdate: () => {
      console.log('🔄 New version available');
      serviceWorkerManager.skipWaiting();
    },
    onOfflineReady: () => {
      console.log('💾 Admin portal cached for offline use');
    }
  });

  serviceWorkerManager.setupNetworkMonitoring();
} else {
  console.log('🛠️ Development mode: Service worker disabled');
  serviceWorkerManager.forceCleanup().catch((error) => {
    console.warn('[SW] Failed to perform dev cleanup:', error);
  });
}
