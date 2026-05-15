# Application Update System

## Overview

Build a two-phase update system on top of GitHub Releases.

- **Phase 1** — A GitHub Actions workflow packages NoteLiner on every push to `main` and publishes a release named `<major>.<minor>.<build>-build.<N>+<githash>` (e.g. `0.6.2-build.142+a1b2c3d`), where `<major>.<minor>.<build>` is the SemVer triplet from `package.json`, `<N>` is a monotonic build number (commit count), and `<githash>` is the short commit SHA included as SemVer build metadata for traceability.
- **Phase 2** — The app surfaces a user-visible mechanism to check GitHub for a newer release, view release notes, and install. This builds on `electron-updater`, which is already wired in.

## Current State

The repo already has most of the scaffolding the user is asking about; this plan extends rather than replaces it.

- `.github/workflows/release.yml` — triggers on `v*` tag push or manual `workflow_dispatch`; builds Linux/Windows/macOS with `npm run release`, which invokes `electron-builder --publish always`.
- `electron-builder.yml:86-90` — `publish.provider: github` is already configured. `electron-builder` uploads installers, the auto-generated `latest*.yml` channel files, and blockmaps to a GitHub Release matching the current `package.json` version.
- `src/main/main.js:204-225` — `autoUpdater.checkForUpdatesAndNotify()` runs once at startup in packaged builds. Events are logged to the git log panel but there is no dedicated update UI, no manual "check now" trigger, and no release-notes display.
- `vite.config.mjs:14-17` — `__APP_VERSION__` is the bare `package.json` version on a tag build (`GITHUB_REF_TYPE=tag`) and `<semver>-dev.<githash>` otherwise. `AboutModal.svelte:32` displays it.
- The version is in `package.json` (`0.6.2`). `package-lock.json` mirrors the same field automatically — there is no separate lockfile version to read.

## Phase 1 — Release Packaging

### Goals

1. Every push to `main` produces an installable build for all three OSes.
2. The release is named `<semver>-build.<N>+<githash>` (e.g. `0.6.2-build.142+a1b2c3d`).
3. The release artifacts (installers + `latest*.yml`) are uploaded so `electron-updater` can find them.
4. Tag-driven "real" releases (`v0.6.2`) continue to work for stable channels.

### Versioning Strategy

Use the commit count as a monotonic build number, then append the hash as SemVer build metadata for traceability:

```
<major>.<minor>.<build>-build.<N>+<githash>
```

Example: `0.6.2-build.142+a1b2c3d`.

- `<major>.<minor>.<build>` comes from `package.json` (`package-lock.json` mirrors the same field — there is no separate lockfile version).
- `<N>` = `git rev-list --count HEAD`. Monotonically increasing across the whole history, even when the `package.json` patch number bumps.
- `+<githash>` is SemVer build metadata — ignored by version comparison (SemVer §10) but visible in the release name, the `latest.yml` `version:` field, and the About dialog.
- The pre-release token `build.N` orders correctly by SemVer rules (numeric pre-release identifiers compare numerically — `build.142 < build.143`).
- A tagged release (`v0.6.2` → version `0.6.2`) compares as greater than any `0.6.2-build.N+...` continuous build, so promoting a tag cleanly graduates pre-release users onto the stable line.

### SemVer Behaviour Worth Knowing

`0.6.2-build.142+a1b2c3d` parses as a pre-release of `0.6.2`. `electron-builder` and `electron-updater` accept it, with two implications to design around:

1. **Pre-releases are considered older than the corresponding final release.** `0.6.2-build.142 < 0.6.2`. If we ever ship a stable `0.6.2` tag, every continuous `0.6.2-build.*` is downgrade-eligible — desirable for the "stable channel graduates pre-release users" workflow, but worth being deliberate about.

2. **`electron-updater` channel routing.** By default it reads `latest.yml`. We will set `allowPrerelease: true` so continuous builds count as the latest channel. A future stable-only channel is a Settings toggle away (see Phase 2).

### Workflow Changes

Add a new workflow `continuous.yml` (separate from `release.yml`) to avoid coupling continuous builds to tag flow.

```yaml
# .github/workflows/continuous.yml
name: Continuous Build

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: continuous-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # needed for `git rev-list --count`

      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }

      - name: Compute version
        id: ver
        shell: bash
        run: |
          BASE=$(node -p "require('./package.json').version")
          BUILD=$(git rev-list --count HEAD)
          HASH=$(git rev-parse --short HEAD)
          FULL="${BASE}-build.${BUILD}+${HASH}"
          echo "full=${FULL}"   >> "$GITHUB_OUTPUT"
          echo "tag=v${FULL}"   >> "$GITHUB_OUTPUT"

      - name: Stamp package.json version
        shell: bash
        run: npm version --no-git-tag-version --allow-same-version "${{ steps.ver.outputs.full }}"

      - name: Install
        run: npm ci
        env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }

      - name: Linux deps
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 imagemagick

      - name: Build & publish
        run: npm run release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # electron-builder will create a "v<full>" release tag automatically
          # because package.json now carries that version.
          EP_PRE_RELEASE: 'true'   # tell electron-builder this is a pre-release
          # signing secrets unchanged from release.yml
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
```

Notes:
- `npm version --no-git-tag-version --allow-same-version` mutates `package.json` and `package-lock.json` in the runner workspace only; the commit is never pushed back. `electron-builder` reads the mutated value when naming the release and writing `latest*.yml`.
- `concurrency` cancels superseded builds when commits land back-to-back. Without it, two pushes one minute apart race each other into GitHub Releases.
- The cross-OS matrix means three runners each push their platform artifacts into the *same* release (electron-builder handles this via `provider: github` and the version-derived release name).
- Build metadata (`+hash`) is stripped from filenames by electron-builder; the hash will appear in `latest.yml` `version:` and in the release title/tag. That is enough for traceability.

### Tagged-Release Workflow

`release.yml` continues unchanged. It exists for promoted releases:

1. Bump `package.json` version (`0.6.2` → `0.6.3`).
2. Tag and push: `git tag v0.6.3 && git push origin v0.6.3`.
3. Workflow builds a stable release that is **greater** than all `0.6.3-build.N+...` continuous builds, so users on the continuous channel are bumped onto the tagged release.

### Versioning Inside the App

`vite.config.mjs` already computes `__APP_VERSION__`. Update it to honour an explicit override from CI so the About dialog matches the release name:

```js
// vite.config.mjs (sketch)
const displayVersion =
  process.env.APP_VERSION_OVERRIDE     // set by CI from steps.ver.outputs.full
  || (onTag ? pkg.version : `${pkg.version}-dev.${gitHash}`);
```

Set `APP_VERSION_OVERRIDE` in `continuous.yml` before `npm run release`. The About dialog (`AboutModal.svelte:32`) then displays `0.6.2-build.142+a1b2c3d` for continuous builds and `0.6.2` for tagged releases — no template changes.

## Phase 2 — In-App Update Check

### Goals

1. User can trigger an update check on demand (not just at startup).
2. App visibly shows update state: idle / checking / available / downloading / downloaded / error.
3. User can see release notes for the offered version.
4. User can choose to install now (restart) or defer.

### Feasibility

Already feasible — `electron-updater` exposes everything we need. The work is mostly UI + IPC plumbing on top of code that already exists in `src/main/main.js:204-225`.

### Approach: Stay on `electron-updater`, Add UI

**Why not a custom GitHub API check?** We would have to (a) reimplement SemVer comparison, (b) handle channel selection, (c) match platform/arch to asset names, (d) download and verify (currently blockmap-accelerated), and (e) install. `electron-updater` does all of this and is already imported. The right work is a thin UI shell around it, not a parallel implementation.

### IPC Surface

Add to `src/main/main.js` and `src/main/preload.js`:

| Channel | Direction | Purpose |
|---|---|---|
| `update:checkNow` | renderer → main | Trigger `autoUpdater.checkForUpdates()` manually |
| `update:downloadNow` | renderer → main | `autoUpdater.downloadUpdate()` (when `autoDownload: false`) |
| `update:installNow` | renderer → main | `autoUpdater.quitAndInstall()` |
| `update:state` | main → renderer | Stream state changes: `{ state, version, percent, error, notes }` |

State machine emitted on `update:state`:

```
idle ──checkNow──▶ checking ──┬─▶ unavailable ──▶ idle
                              ├─▶ available  ──downloadNow──▶ downloading
                              └─▶ error      ──▶ idle
downloading ──┬─▶ downloaded ──installNow──▶ (app restarts)
              └─▶ error
```

Wire `autoUpdater` events to these states:

```js
autoUpdater.autoDownload = false;          // user-driven, not silent
autoUpdater.on('checking-for-update', () => send({ state: 'checking' }));
autoUpdater.on('update-available',    (i) => send({ state: 'available', version: i.version, notes: i.releaseNotes }));
autoUpdater.on('update-not-available',() => send({ state: 'unavailable' }));
autoUpdater.on('download-progress',   (p) => send({ state: 'downloading', percent: p.percent }));
autoUpdater.on('update-downloaded',   (i) => send({ state: 'downloaded', version: i.version }));
autoUpdater.on('error',               (e) => send({ state: 'error',      error: e.message }));
```

`autoDownload = false` means users see "Update available — Download" before bytes move. Important on metered connections; matches the existing About-modal-driven UX implied by Phase 2.

### UI Surface

Two touch points, no new modal needed:

1. **About modal** (`AboutModal.svelte`) — Replace the current bare version line with a status block:

   ```
   Version 0.6.2-build.142+a1b2c3d                  [Check for Updates]
   Status: Up to date / Checking… / 0.6.3 available [Download] / etc.
   ```

   When an update is available, expand to show release notes and a `Download` button. After download, show `Restart and Install`.

2. **Toolbar badge** (optional, low effort) — When state is `available` or `downloaded`, add a small dot to the About icon (`Ctrl+I`) so users notice without opening the modal.

A renderer store `stores/update.svelte.js` holds the current state and is the only consumer of `update:state`. AboutModal subscribes; the toolbar badge subscribes.

### Allow Pre-Release Channel

For users on the continuous channel:

```js
autoUpdater.allowPrerelease = true;
autoUpdater.channel = 'latest';   // continuous builds still go to latest.yml
```

If we later add a stable-only channel (recommended for non-developer users), we expose a Settings toggle: "Receive pre-release builds" → flips `allowPrerelease`. Out of scope for the initial implementation but the IPC/store design above does not preclude it.

### Startup Behaviour

Keep the existing startup check (`main.js:220`) but switch it to `checkForUpdates()` (without `andNotify`) so the new state machine drives all user-visible behaviour. The OS-native notification path is replaced by the in-app status block.

## Risks & Open Questions

1. **Release storm on busy days.** Every push to `main` triggers a full three-OS build (~10–15 min each). For an app with a few merges per day this is fine; if traffic grows, add `paths-ignore` (docs/, tests/) and rely on `concurrency` to cancel.
2. **Unsigned artifacts.** Without code-signing certs (already noted in `electron-builder.yml:54-55, 72-74`), Windows SmartScreen and macOS Gatekeeper warn on every continuous build. Users on the continuous channel get this on every update. Phase 2 should display a one-time warning the first time a pre-release update is offered.
3. **Disk usage on the GitHub side.** A release per commit × ~80 MB of installers × 3 platforms can fill the release page quickly. Add a cleanup workflow that prunes continuous releases older than N days, keeping only the latest M. Out of scope for the initial implementation but worth a follow-up plan.
4. **Test harness.** Playwright tests use `isTest` (`main.js:206`) to skip the updater. No change needed — the new IPC handlers are added inside the same `app.isPackaged && !isTest` block.

## Implementation Order

1. Add `.github/workflows/continuous.yml`, the version-stamp step, and `APP_VERSION_OVERRIDE` plumbing in `vite.config.mjs`. Verify one continuous build lands as a GitHub pre-release with the expected name.
2. Switch `main.js` updater wiring to `autoDownload = false` + the explicit event handlers above. Add the four IPC channels and preload exposure.
3. Add `stores/update.svelte.js` and wire AboutModal to it. Add Check / Download / Install buttons and release-notes rendering.
4. (Optional) Toolbar badge.
5. (Follow-up) Cleanup workflow for pruning old continuous releases.

## Files Touched

- `.github/workflows/continuous.yml` (new)
- `vite.config.mjs` (honour `APP_VERSION_OVERRIDE`)
- `src/main/main.js` (rework updater wiring, add IPC handlers)
- `src/main/preload.js` (expose `update.*` to renderer)
- `src/renderer/stores/update.svelte.js` (new)
- `src/renderer/components/AboutModal.svelte` (status block, buttons)
- `src/renderer/components/Toolbar.svelte` (optional badge)
