import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    // Suppress a11y warnings for Electron desktop app
    if (warning.code.startsWith('a11y')) return;
    handler(warning);
  }
};
