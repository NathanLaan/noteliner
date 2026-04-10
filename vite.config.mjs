import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
let gitHash = 'dev';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
} catch { /* not in a git repo */ }

export default defineConfig({
  plugins: [svelte()],
  base: './',
  root: 'src/renderer',
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version}.${gitHash}`)
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  }
});
