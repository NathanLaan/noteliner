const { test: base, _electron, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const test = base.extend({
  tmpEnv: async ({}, use) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-test-'));
    const userData = path.join(root, 'userdata');
    const project = path.join(root, 'project');
    fs.mkdirSync(userData);
    fs.mkdirSync(project);
    await use({ root, userData, project });
    fs.rmSync(root, { recursive: true, force: true });
  },

  project: async ({ tmpEnv }, use) => { await use(tmpEnv.project); },
  userData: async ({ tmpEnv }, use) => { await use(tmpEnv.userData); },

  app: async ({ tmpEnv }, use) => {
    const electronApp = await _electron.launch({
      args: [
        REPO_ROOT,
        `--user-data-dir=${tmpEnv.userData}`,
        '--no-sandbox',
      ],
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // Ensure git commits succeed without touching the user's ~/.gitconfig.
        // These are honored by every git child process spawned via execFile.
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com',
      },
    });
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    // Wait for the renderer to install test helpers (onMount fires after DOMContentLoaded).
    await window.waitForFunction(() => !!window.__nlTest, null, { timeout: 10_000 });
    await use({ electronApp, window, ...tmpEnv });
    try {
      await electronApp.close();
    } catch { /* already closed */ }
  },
});

module.exports = { test, expect };
