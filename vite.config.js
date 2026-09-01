import { defineConfig } from 'vite';

// The site is served from https://<user>.github.io/dust-machine/, so assets
// need that prefix in production. Locally the base stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dust-machine/' : '/',
  build: { outDir: 'dist', assetsDir: 'assets' }
}));
