/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**/*'],
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Split React vendor chunk smaller
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            
            // Split large libraries
            if (id.includes('@dnd-kit') || id.includes('dnd-kit')) return 'dnd-kit';
            if (id.includes('@supabase') || id.includes('supabase')) return 'supabase';
            if (id.includes('react-router')) return 'vendor-router';
            
            return 'vendor';
          }
          
          // Admin chunk splitting
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
          
          // Org workspace code together
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
