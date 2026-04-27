// src/config/api.ts

// Define a single source of truth for the API base URL.
// Allow an explicit Vite env override so E2E/test environments can
// point the frontend at a locally-running backend on a different port.
// Example: VITE_API_BASE_URL=http://127.0.0.1:8888
export const API_BASE =
  (import.meta.env as any).VITE_API_BASE_URL ??
  (import.meta.env.MODE === 'development' ? 'http://localhost:3000' : 'https://api.the-huddle.co');
