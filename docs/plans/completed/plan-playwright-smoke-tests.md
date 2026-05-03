# Playwright Smoke Tests — Implementation Plan

## Overview

Stand up a minimal Playwright + `@playwright/test` test harness against a
packaged-but-unsigned Electron build, with five smoke tests that exercise
the load-bearing user flows. The aim is **not** comprehensive coverage —
it is "we will notice when persistence, project loading, or core editing
breaks."

This is the cheapest insurance NoteLiner can buy. It pairs naturally with
`plan-distribution.md` (CI infrastructure) and
`plan-large-vault-performance.md` (shares the harness).

## Goals

1. CI runs the suite on every PR; failures block merge.
2. Suite finishes in under two minutes on a CI runner.
3. Five tests cover the non-negotiable golden paths: open, create, edit,
   restart, delete.
4. Easy to run locally: `npm test` works after `npm install`.
5. Tests use a real project on a real filesystem in a temp directory —
   no mocks of `fs` or `git`. The whole point is integration.

## Current State

- **No tests exist.** `package.json` has no `test` script, no test runner,
  no test files. `node_modules` does not include any test framework.
- **Electron entry:** `src/main/main.js` is the main process; it loads
  `dist/index.html` (vite build) or the dev server.
- **Persistence layers** to verify under test:
  - `noteliner.json` — project index.
  - `_attachments/` directory — binary attachments.
  - `{userData}/window-state.json` — per-project layout.
  - `{userData}/ui-preferences.json` — global theme, recents, etc.
- **Git** is invoked synchronously by `git-service.js`. Tests need git
  installed on the runner (CI runners have it by default).

## Tools

- **`@playwright/test`** — runner, assertions, parallel test scheduling.
- **`playwright`** — driving Electron via `_electron.launch()`.
- Both available from a single `playwright` install. No `electron-mocha` or
  `spectron`-era stuff.

```bash
npm install --save-dev @playwright/test playwright
```

## Test Surface (what to test)

Five smoke tests. Each is the smallest possible exercise of a
non-recoverable failure mode.

### Test 1 — `app.boots`

App launches, window appears, OpenScreen renders. No project required.

**Failure means:** main process crash, preload broken, renderer can't
start. Recovery cost: high. Detection cost: trivial.

### Test 2 — `project.create-and-persist`

1. Launch with `--user-data-dir=$TMP/userdata`.
2. From OpenScreen, choose "Create new project" pointed at `$TMP/proj`.
3. Create a note named "Hello," type "world" in the editor, wait for
   auto-save.
4. Close the app.
5. Verify on disk:
   - `$TMP/proj/noteliner.json` has one entry named "Hello".
   - `$TMP/proj/hello.md` (or slug variant) contains "world".
   - `git log` in `$TMP/proj` has at least two commits (init + add).
6. Relaunch the app with the same user-data-dir and project; "Hello" is
   present in the FILES pane and selecting it shows "world".

**Failure means:** the persistence chain (write → commit → reload) is
broken. This is the test that earns its keep.

### Test 3 — `editor.edit-and-rename`

1. Open the project from Test 2 (or recreate one inline — keep tests
   independent).
2. Select "Hello," type additional content. Wait for save.
3. Rename "Hello" to "Greetings". Verify the file on disk renames
   (`hello.md` → `greetings.md`), `noteliner.json` updates, content
   preserved.
4. Verify a git commit was made for the rename.

**Failure means:** rename + content + git lost sync. Historically a high-
risk operation in any note app.

### Test 4 — `delete.removes-from-disk-and-index`

1. With a project containing 3 notes, delete one.
2. Verify the file is removed from disk and `noteliner.json` no longer
   lists it.
3. Verify a git commit captures the deletion.

**Failure means:** orphan files in the repo or stale entries in the index.

### Test 5 — `attachment.paste-and-persist`

1. With a note open, programmatically simulate pasting a small PNG.
2. Verify the file lands in `$TMP/proj/_attachments/`, `noteliner.json`
   `attachments[]` for that note has the entry, and the editor body
   contains a markdown image reference.
3. Restart the app; the attachment is still listed, image still loads
   in preview.

**Failure means:** attachment pipeline broken — paste/drop/picker share
this code path so this one test guards all three.

These five exercise: launch, create, edit, rename, delete, attach,
restart. That's the vital signs.

## Implementation Steps

### Step 1: Install + scaffold

```bash
npm install --save-dev @playwright/test playwright
```

**New file:** `playwright.config.js`

```js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,         // electron tests share a window
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
```

`fullyParallel: false` because each test launches a real Electron process;
a single CI runner can't sanely host 5 in parallel. Sequential is fast
enough (sub-2-minute target).

### Step 2: Test fixture for launching the app

**New file:** `tests/e2e/fixtures.js`

```js
const { test: base, _electron } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

exports.test = base.extend({
  tmpEnv: async ({}, use) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-test-'));
    const userData = path.join(root, 'userdata');
    const project = path.join(root, 'project');
    fs.mkdirSync(userData);
    fs.mkdirSync(project);
    await use({ root, userData, project });
    fs.rmSync(root, { recursive: true, force: true });
  },

  app: async ({ tmpEnv }, use) => {
    const electronApp = await _electron.launch({
      args: [REPO_ROOT, `--user-data-dir=${tmpEnv.userData}`, '--no-sandbox'],
      cwd: REPO_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use({ electronApp, window, ...tmpEnv });
    await electronApp.close();
  },
});

exports.expect = require('@playwright/test').expect;
```

Key choices:

- **One temp dir per test.** No state leaks between tests.
- **Custom `--user-data-dir`** isolates `noteliner.json` cache,
  `ui-preferences.json`, etc.
- **`--no-sandbox`** required on most Linux CI runners.
- **`NODE_ENV=test`** — used inside main to skip behaviors that don't
  belong in tests (e.g., `autoUpdater.checkForUpdatesAndNotify`).

### Step 3: Test-mode hooks in main

To make tests deterministic without leaking test code into prod, add
small `NODE_ENV === 'test'` guards in main:

```js
// src/main/main.js
const isTest = process.env.NODE_ENV === 'test';

if (!isTest) {
  setupAutoUpdater();
  setupTelemetry();   // when/if added
}

ipcMain.handle('test:openProject', async (_e, folderPath) => {
  if (!isTest) throw new Error('test-only handler');
  return projectService.openProject(folderPath);
});
```

The `test:*` handlers let tests skip past UI-only flows (e.g., the
"Open Folder" native dialog, which Playwright cannot drive). In v1 we
only need `test:openProject` and `test:createProject` to bypass the
file-picker.

### Step 4: Write the tests

**New file:** `tests/e2e/01-boot.spec.js`

```js
const { test, expect } = require('./fixtures');

test('app boots', async ({ app }) => {
  await expect(app.window.locator('text=NoteLiner')).toBeVisible();
});
```

**New file:** `tests/e2e/02-create-and-persist.spec.js`

```js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { test, expect } = require('./fixtures');

test('create note, persist, reload', async ({ app, project }) => {
  // Init project via test handler (skips folder dialog)
  await app.window.evaluate((p) => window.api.initProject(p, null), project);

  // Create a note via test handler
  await app.window.evaluate(() =>
    window.api.createFile('Hello', []));

  // Type into the editor
  const editor = app.window.locator('.cm-content');
  await editor.click();
  await app.window.keyboard.type('world');

  // Wait for auto-save
  await app.window.waitForTimeout(700);

  // Close + verify on disk
  await app.electronApp.close();

  const indexPath = path.join(project, 'noteliner.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  expect(index.files).toHaveLength(1);
  expect(index.files[0].name).toBe('Hello');

  const filename = index.files[0].filename;
  const body = fs.readFileSync(path.join(project, filename), 'utf-8');
  expect(body).toContain('world');

  // Verify git commits
  const log = execSync('git log --oneline', { cwd: project }).toString();
  expect(log.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(2);
});
```

(Other tests follow the same shape — exercise via `window.api.*`, assert
in DOM and on disk.)

### Step 5: npm scripts

```json
"scripts": {
  "test": "playwright test",
  "test:headed": "playwright test --headed",
  "test:debug": "PWDEBUG=1 playwright test"
}
```

Add `tests/` to `.gitignore` for any output: `tests/output/`,
`test-results/`, `playwright-report/`.

### Step 6: CI workflow

**New file:** `.github/workflows/test.yml`

```yaml
name: Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Build renderer
        run: npm run build
      - name: Linux Electron deps
        run: |
          sudo apt-get update
          sudo apt-get install -y xvfb libnss3 libatk-bridge2.0-0 libgtk-3-0
      - name: Run tests
        run: xvfb-run -a npm test
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

Linux-only for v1. Windows / macOS runners cost more and the smoke
suite mostly catches OS-agnostic failures. Add platform matrix later if
a regression slips by.

### Step 7: Documentation

Add a `## Testing` section to README:

```
npm test            # run the smoke suite
npm run test:headed # show the Electron window while tests run
npm run test:debug  # step through with Playwright inspector
```

And a one-paragraph `tests/README.md` explaining the layout and the
"5 smoke tests, not comprehensive" mandate, so contributors don't bury it
under 500 unit tests.

## Edge Cases

- **Slow CI:** Linux GitHub runner spends ~20s on Electron cold-launch
  the first time. Total suite target ~90s. If we creep past 2 minutes,
  trim, don't parallelize.
- **xvfb required on Linux CI:** without a display server, Electron
  refuses to launch. The workflow above wraps the test step in
  `xvfb-run`.
- **Native dialogs cannot be driven** (file pickers, system confirms).
  Hence the `test:*` IPC bypasses for project init / file create. Don't
  try to mock `dialog.showOpenDialogSync` — the bypass is cleaner.
- **Git config on CI:** `git commit` requires `user.name` /
  `user.email`. Set them in the workflow's "Init test project" or in the
  test fixture by writing a `.git/config` at init time. (NoteLiner's own
  `setGitConfig` flow is fine for tests too.)
- **Flaky timing:** `waitForTimeout(700)` is fine for a 500ms-debounced
  auto-save; never use `waitForTimeout` to poll for state. Use
  `expect.poll(...)` if a check needs retry.
- **Test-only IPC handlers in production:** the `if (!isTest) throw`
  guard is essential. A leaked test handler is a silent backdoor.

## Testing the Tests

Run locally on your dev machine (`npm test`), then push. CI must pass on
the first PR that adds the suite — if it doesn't, the suite is too
flaky to ship.

A reasonable bar: ten consecutive green CI runs across ten unrelated PRs
before we trust the suite. If it flakes on three or more in that window,
fix or remove the offending test rather than retrying.

## Out of Scope (V1)

- **Unit tests.** Worth adding later for `frontmatter-service`,
  `link-graph-service`, etc., but the user-facing flows are the priority.
- **Cross-platform CI** (Windows, macOS runners). Add when we have signed
  builds (per `plan-distribution.md`) and CI minutes to spare.
- **Visual regression.** Playwright supports screenshot diffing; not
  worth the maintenance cost for v1.
- **Performance assertions in tests.** Belongs in the bench harness
  (`plan-large-vault-performance.md`), not the smoke suite.
- **Coverage tracking** (`c8`, `nyc`). For five integration tests it's
  meaningless.

## Rollout

One PR adds the harness, the five tests, and the CI workflow. The PR
that adds it is the suite's first real-world test — if the workflow
flakes on its own merge, fix it before adding more tests.
