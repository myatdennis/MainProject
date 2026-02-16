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

  const isDev = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
  const requestedPort = Number(process.env.VITE_PORT || 5174);
  let activeViteOrigin = `http://localhost:${requestedPort}`;
  if (isDev && (!process.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL.trim() === '')) {
    process.env.VITE_API_BASE_URL = '/api';
  }

  if (isDev) {
    console.info(`[vite] Attempting to start dev server on port ${requestedPort} (strictPort: false)`);
  }

  return defineConfig({
    define: {
      ...(process.env.NODE_ENV === 'development'
        ? { 'import.meta.env.VITE_WS_URL': JSON.stringify('ws://localhost:8888/ws') }
        : {}),
    },
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
        'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
      // Ensure any linked packages (e.g., local component libraries or the admin
      // backup bundle) reuse this project's single React instance during dev.
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
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
      port: requestedPort,
      strictPort: false,
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
          secure: false,
          ws: true,
          cookieDomainRewrite: { '*': '' },
          configure: (proxy) => {
            if (!isDev) return;
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers?.cookie) {
                proxyReq.setHeader('cookie', req.headers.cookie);
              }
              if (!proxyReq.getHeader('origin')) {
                proxyReq.setHeader('origin', activeViteOrigin);
              }
              console.log('[vite-proxy][api] request', {
                method: req.method,
                url: req.url,
              });
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              const setCookieHeader = proxyRes.headers?.['set-cookie'];
              let cookieNames: string[] = [];
              if (Array.isArray(setCookieHeader)) {
                cookieNames = setCookieHeader.map((entry) => String(entry).split('=')[0]);
              } else if (typeof setCookieHeader === 'string') {
                cookieNames = [setCookieHeader.split('=')[0]];
              }
              console.log('[vite-proxy][api] response', {
                method: req.method,
                url: req.url,
                statusCode: proxyRes.statusCode,
                hasSetCookie: Array.isArray(setCookieHeader)
                  ? setCookieHeader.length > 0
                  : Boolean(setCookieHeader),
                cookieNames,
                setCookieHeader,
              });
            });
          },
        },
        '/ws': {
          target: 'ws://localhost:8888',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    configureServer(viteServer) {
      if (!isDev) return;
      viteServer.httpServer?.once('listening', () => {
        const address = viteServer.httpServer?.address();
        const actualPort =
          typeof address === 'object' && address && typeof address.port === 'number'
            ? address.port
            : requestedPort;
        activeViteOrigin = `http://localhost:${actualPort}`;
        console.info(`[vite] Dev server listening on ${activeViteOrigin}`);
        process.env.VITE_ACTIVE_PORT = String(actualPort);
      });
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
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
              // Keep Supabase libraries in the shared vendor chunk to avoid cross-chunk
              // circular imports that can trigger "Cannot access '<var>' before initialization"
              // errors in production builds.
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
