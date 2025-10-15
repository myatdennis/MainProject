import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import serviceWorkerManager from './utils/ServiceWorkerManager';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Register service worker for offline capabilities and caching
if (import.meta.env.PROD) {
  serviceWorkerManager.register({
    onSuccess: () => {
      console.log('Admin portal is ready for offline use');
    },
    onUpdate: () => {
      console.log('New version available');
      // Auto-update in production for admin users
      serviceWorkerManager.skipWaiting();
    },
    onOfflineReady: () => {
      console.log('Admin portal cached for offline use');
    }
  });

  // Set up network monitoring
  serviceWorkerManager.setupNetworkMonitoring();
}
