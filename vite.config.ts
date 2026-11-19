import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: 'web',
  envDir: '..', // keep VITE_* keys in the project-root .env
  plugins: [react()],
  resolve: { alias: { '@shared': at('./shared') } },
  server: { proxy: { '/api': 'http://localhost:8787' } },
  build: { outDir: '../dist', emptyOutDir: true },
  test: { root: '.', include: ['{shared,web,server}/**/*.test.ts'] },
});
