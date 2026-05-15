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

// APP_VERSION_OVERRIDE (set by continuous.yml) wins so continuous-channel
// builds display the full <semver>-build.<N>+<githash>. Otherwise: tagged CI
// builds (GITHUB_REF_TYPE=tag) show the bare semver, and everything else (dev
// runs, ad-hoc builds) gets the "-dev.<hash>" suffix.
const onTag = process.env.GITHUB_REF_TYPE === 'tag';
const displayVersion =
  process.env.APP_VERSION_OVERRIDE
  || (onTag ? pkg.version : `${pkg.version}-dev.${gitHash}`);

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
