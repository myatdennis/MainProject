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
  const requestedPort = Number(process.env.VITE_PORT || 5173);
  let activeViteOrigin = `http://localhost:${requestedPort}`;
  if (isDev && (!process.env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL.trim() === '')) {
    process.env.VITE_API_BASE_URL = '/api';
  }

  if (isDev) {
    console.info(`[vite] Attempting to start dev server on port ${requestedPort} (strictPort: false)`);
  }

  return defineConfig({
    define: {
      // Build version stamp — visible in browser console as __APP_BUILD_TIME__
      // Confirms which bundle is running after a deploy. Check: console.log(__APP_BUILD_TIME__)
      __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      ...(process.env.NODE_ENV === 'development'
        ? { 'import.meta.env.VITE_WS_URL': JSON.stringify('ws://localhost:3000/ws') }
        : {}),
    },
    plugins: [
      react(),
      // Optionally add compression plugin to reduce asset size for production builds
      ...(process.env.NODE_ENV === 'production' && compression ? [compression({ algorithm: 'brotliCompress' })] : []),
      // Inline plugin: capture the actual port Vite chose (may differ from
      // requestedPort when strictPort=false) and update activeViteOrigin so
      // the proxy Origin header stays accurate.
      {
        name: 'capture-vite-port',
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
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
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
          // Allow the proxy target to be overridden at startup so E2E runs can
          // point directly at the E2E API server (port 8888, E2E_TEST_MODE=true)
          // instead of the regular dev server (port 3000).  The default stays
          // localhost:3000 so normal dev-server usage is unchanged.
          target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
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
              // Cast to the union that node's http module actually produces for headers;
              // http-proxy types the header map as Record<string, string | string[]>
              // which narrows to `never` after the Array.isArray guard in some TS versions.
              const rawHeader = proxyRes.headers?.['set-cookie'] as string | string[] | undefined;
              const setCookieHeader = rawHeader;
              let cookieNames: string[] = [];
              if (Array.isArray(setCookieHeader)) {
                cookieNames = setCookieHeader.map((entry) => String(entry).split('=')[0]);
              } else if (typeof setCookieHeader === 'string') {
                cookieNames = [(setCookieHeader as string).split('=')[0]];
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
          target: process.env.VITE_API_PROXY_TARGET
            ? process.env.VITE_API_PROXY_TARGET.replace(/^http/, 'ws')
            : 'ws://localhost:3000',
          ws: true,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    build: {
      outDir: 'dist',
      sourcemap: process.env.NODE_ENV !== 'production',
      minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
      target: 'es2015',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
          manualChunks(id: string) {
            // Keep the sync service + its DAL facade together to avoid Rollup
            // circular-chunk warnings caused by re-export style usage across
            // lazily loaded admin/client entrypoints.
            if (id.includes('src/services/syncService.ts') || id.includes('src/dal/sync.ts')) {
              return 'sync';
            }
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

            // Keep org workspace code in default chunking to avoid circular chunk graphs
            // when admin surfaces import org workspace components.
          },
        },
      },
    },
  });
};
