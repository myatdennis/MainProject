<<<<<<< HEAD
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import serviceWorkerManager from './utils/ServiceWorkerManager';
=======
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// No global error overlay installed in this version
>>>>>>> 044fb72 (Fix workflow context access and remove unused code)

console.log('🚀 MainProject App initializing...');
console.log('📍 Environment:', import.meta.env.MODE);
console.log('🔧 Supabase configured:', !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY));
console.log('⚙️ React version detected:', React?.version || 'unknown');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found! Cannot render app.');
  document.body.innerHTML = '<div style="padding: 40px; font-family: system-ui; color: #dc3545;"><h1>Error: Root Element Missing</h1><p>The #root div is missing from index.html</p></div>';
} else {
<<<<<<< HEAD
  console.log('✅ Root element found, rendering app...');
  
=======
  console.log("✅ Root element found, rendering minimal app...");


>>>>>>> 044fb72 (Fix workflow context access and remove unused code)
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <HelmetProvider>
          <App />
        </HelmetProvider>
      </StrictMode>
    );
<<<<<<< HEAD
    console.log('✅ App rendered successfully');
=======
  // No app-mounted marker set in this version
    console.log("✅ Minimal app rendered successfully");
>>>>>>> 044fb72 (Fix workflow context access and remove unused code)
  } catch (error) {
    console.error('❌ Error rendering app:', error);
    rootElement.innerHTML = `<div style="padding: 40px; font-family: system-ui; color: #dc3545;"><h1>Error Rendering App</h1><pre>${error}</pre></div>`;
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
}
