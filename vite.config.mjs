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

// On a tagged CI build, GITHUB_REF_TYPE === 'tag' and GITHUB_REF_NAME is the
// tag. Released builds display the bare semver (e.g. "0.5.0") instead of the
// dev suffix.
const onTag = process.env.GITHUB_REF_TYPE === 'tag';
const displayVersion = onTag ? pkg.version : `${pkg.version}-dev.${gitHash}`;

export default defineConfig({
  plugins: [svelte()],
  base: './',
  root: 'src/renderer',
  server: {
    port: 5250,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(displayVersion)
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        help: path.resolve(__dirname, 'src/renderer/help.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  }
});
