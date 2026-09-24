import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/',
  server: {
    host: "::",
    port: 8080,
    watch: {
      ignored: ['**/*.xlsx', '**/*.xls', '**/*.csv', '**/*.log', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.tmp', '**/*.~tmp', '**/Certificate-*']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs') || id.includes('xlsx') || id.includes('jszip')) {
              return 'vendor-excel';
            }
            if (id.includes('hyperformula')) {
              return 'vendor-hyperformula';
            }
            if (id.includes('apexcharts') || id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('jodit') || id.includes('jodit-react')) {
              return 'vendor-editor';
            }
          }
        },
      },
    },
  },
}));
