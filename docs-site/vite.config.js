import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/guarana/',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
