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
            if (id.includes('react') || id.includes('react-dom') || id.includes('lucide-react')) {
              return 'vendor-react';
            }
            return 'vendor';
          }
          if (id.includes('components/OrgWorkspace') || id.includes('services/clientWorkspaceService')) {
            return 'org-workspace';
          }
        },
      },
    },
  },
});
