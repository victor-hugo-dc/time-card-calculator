import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  plugins: [react()],
  optimizeDeps: {
    include: ['@mui/x-date-pickers', '@mui/x-date-pickers/AdapterDateFns'],
  },
});