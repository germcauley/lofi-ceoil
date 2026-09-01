import { defineConfig } from 'vite';

// The site is served from https://<user>.github.io/lofi-ceoil/, so assets
// need that prefix in production. Locally the base stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/lofi-ceoil/' : '/',
  build: { outDir: 'dist', assetsDir: 'assets' }
}));
