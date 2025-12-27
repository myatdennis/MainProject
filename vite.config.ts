/// <reference types="vitest" />
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// compression is optional; dynamic import in async export
// Note: We purposely do not declare the compression module; dynamic import below is guarded with @ts-ignore

export default async () => {
  let compression = null;
  try {
    const compressionPackage = 'vite-plugin-compression';
    compression = (await import(compressionPackage)).default;
  } catch (e) {
    compression = null;
  }
  // Allow developers to override HMR connection details for remote-dev or tunnel
  // scenarios, but fall back to Vite defaults when no env vars are set so we
  // don't accidentally point the websocket at an unreachable host.
  const hmrHost = process.env.VITE_HMR_HOST || process.env.HMR_HOST;
  const hmrProtocol = process.env.VITE_HMR_PROTOCOL || process.env.HMR_PROTOCOL;
  const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT || process.env.HMR_CLIENT_PORT;

  return defineConfig({
  plugins: [
    react(),
    // Optionally add compression plugin to reduce asset size for production builds
    ...(process.env.NODE_ENV === 'production' && compression ? [compression({ algorithm: 'brotliCompress' })] : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Hard-pin React packages to a single physical path so Vite never bundles
      // multiple copies, which would trigger "Invalid hook call" errors when
      // navigating to admin routes that are code-split into secondary chunks.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client')
    },
    // Ensure any linked packages (e.g., local component libraries or the admin
    // backup bundle) reuse this project's single React instance during dev.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**'],
  },
  server: {
    host: true,
    port: 5174,
    strictPort: true,
    hmr: {
      ...(hmrHost ? { host: hmrHost } : {}),
      ...(hmrProtocol ? { protocol: hmrProtocol } : {}),
      ...(hmrClientPort ? { clientPort: Number(hmrClientPort) } : {}),
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        // Ensure Vite forwards cookies/headers correctly to the API server
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:8888',
        ws: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          // Further split common large libraries
          if (id.includes('zod')) return 'zod';
          if (id.includes('date-fns')) return 'date-fns';
          if (id.includes('lodash')) return 'lodash';
          if (id.includes('react-hook-form')) return 'react-hook-form';
          if (id.includes('zustand')) return 'zustand';
          if (id.includes('@tanstack/table') || id.includes('tanstack-table')) return 'tanstack-table';
          if (id.includes('node_modules')) {
            // Avoid splitting React and ReactDOM into separate manual chunks to prevent
            // cross-chunk ordering/linking issues in production builds.
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@dnd-kit') || id.includes('dnd-kit')) return 'dnd-kit';
            if (id.includes('@supabase') || id.includes('supabase')) return 'supabase';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('framer-motion')) return 'framer-motion';
            if (id.includes('@tanstack/react-query')) return 'react-query';
            if (id.includes('axios')) return 'axios';
            if (id.includes('react-router')) return 'vendor-router';
            return 'vendor';
          }

          if (id.includes('/src/pages/Admin/AdminSurveyBuilder') || id.includes('/src/components/SurveyBuilder')) {
            return 'admin-surveys';
          }
          if (id.includes('/src/pages/Admin/AdminCourseBuilder') || id.includes('/src/components/CourseBuilder')) {
            return 'admin-courses';
          }
          if (id.includes('/src/pages/Admin/AdminAnalytics') || id.includes('/src/pages/Admin/AdminReports')) {
            return 'admin-analytics';
          }
          if (id.includes('/src/pages/Admin/') && !id.includes('AdminDashboard') && !id.includes('AdminLogin')) {
            return 'admin-secondary';
          }
          if (id.includes('/src/components/OrgWorkspace') || id.includes('/src/services/clientWorkspaceService')) {
            return 'org-workspace';
          }
        },
      },
    },
    target: 'es2015',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
  });
};
