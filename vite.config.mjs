import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
let gitHash = 'dev';
let commitCount = '0';
try {
  gitHash = execSync('git rev-parse --short HEAD').toString().trim();
  commitCount = execSync('git rev-list --count HEAD').toString().trim();
} catch { /* not in a git repo */ }

// Strip any pre-release / build-metadata that may already be on pkg.version
// (e.g. when continuous.yml has stamped it via `npm version`) so we don't
// double-append "-build.N+hash-build.N+hash".
const baseVersion = pkg.version.split(/[-+]/)[0];

// APP_VERSION_OVERRIDE (set by continuous.yml) wins. Otherwise tagged CI
// builds (GITHUB_REF_TYPE=tag) show the bare semver, and everything else —
// local dev runs, ad-hoc builds — composes the same <semver>-build.<N>+<hash>
// scheme used by the continuous workflow.
const onTag = process.env.GITHUB_REF_TYPE === 'tag';
const displayVersion =
  process.env.APP_VERSION_OVERRIDE
  || (onTag ? baseVersion : `${baseVersion}-build.${commitCount}+${gitHash}`);

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
