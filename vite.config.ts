import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Group react + related into a react vendor chunk
            if (id.includes('react') || id.includes('react-dom') || id.includes('lucide-react')) {
              return 'vendor-react';
            }
            // Large third-party libraries we want split
            if (id.includes('@dnd-kit') || id.includes('dnd-kit')) return 'dnd-kit';
            if (id.includes('@supabase') || id.includes('supabase')) return 'supabase';
            return 'vendor';
          }
          // Keep org workspace code together
          if (id.includes('/src/components/OrgWorkspace') || id.includes('/src/services/clientWorkspaceService')) {
            return 'org-workspace';
          }
        },
      },
    },
  },
});
