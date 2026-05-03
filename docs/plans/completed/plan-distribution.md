# Distribution & Signed Builds — Implementation Plan

## Overview

Replace the current "clone the repo, run `npm install`, run `npm start`"
install path with downloadable, signed, auto-updating native builds for
Linux (AppImage, .deb), Windows (NSIS installer + portable), and macOS
(.dmg, signed + notarized). Drive everything through `electron-builder`
and GitHub Releases via a CI workflow.

This is the gap that turns "I built a tool for me" into "anyone can run
this in under a minute."

## Goals

1. A non-developer user can install NoteLiner on any of macOS, Windows,
   Linux without a Node toolchain.
2. Tagged releases produce signed binaries on all three OSes via GitHub
   Actions, attached to a GitHub Release.
3. The app silently checks for updates on launch and offers to install.
4. Code signing on Windows and macOS so OS-level smart-screen / Gatekeeper
   stop scaring users.
5. The dev workflow does not get heavier — `npm run electron:dev` still
   works as it does today.

## Current State

- **`package.json`** has no `build:*` scripts beyond `vite build` for the
  renderer. No `electron-builder` config.
- **`scripts/install-desktop.sh`** generates a Linux `.desktop` file
  pointing at the source checkout. Useful for dev; not a real install.
- **Versioning** combines SemVer + git short hash at build time
  (`README.md:73`). Built artifacts will need a deterministic version that
  matches the tag.
- **Assets:** `assets/icon.png` exists. No `.icns` (macOS) or `.ico`
  (Windows). No DMG background, no installer banner.
- **No CI workflow exists** in `.github/`.

## Strategy

### Build tool: `electron-builder`

The de facto choice for Electron packaging. Handles all three platforms,
auto-update (`electron-updater`), code signing, and GitHub Releases
publishing. The alternatives (`electron-forge`, `electron-packager`) work
but `electron-builder` integrates best with the auto-update + GitHub
Releases combination we want.

### Target formats

| OS | Format(s) | Why |
|---|---|---|
| Linux | AppImage, deb | AppImage is universal; deb for Debian/Ubuntu users |
| Windows | NSIS installer, portable .exe | NSIS for normal users; portable for IT-locked envs |
| macOS | dmg, zip | dmg is canonical; zip is needed for auto-update delta |

Skip RPM, Snap, MSI, MAS for v1 — file an issue if anyone asks.

### Code signing

- **Windows:** an EV or OV code-signing certificate. Costs ~$70–300/yr.
  Stored as base64-encoded PFX in a GitHub Actions secret
  (`WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`).
- **macOS:** Apple Developer Program ($99/yr). `Developer ID Application`
  certificate exported to a `.p12`, stored as
  `MAC_CSC_LINK` / `MAC_CSC_KEY_PASSWORD`. Notarization via
  `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.
- **Linux:** no signing (AppImage signature optional and rarely verified).

If signing certs aren't yet available, ship unsigned in v1 and **document
the SmartScreen / Gatekeeper warnings** so users aren't blindsided.
Treating unsigned as "v0.5 release" is a fine first step.

## Implementation Steps

### Step 1: Add electron-builder config

```bash
npm install --save-dev electron-builder
```

**New file:** `electron-builder.yml`

```yaml
appId: com.nathanlaan.noteliner
productName: NoteLiner
copyright: Copyright © 2026 Nathan Laan

directories:
  output: dist-electron
  buildResources: build

files:
  - "src/main/**/*"
  - "dist/**/*"        # built renderer (Vite output)
  - "package.json"
  - "node_modules/**/*"
  - "!node_modules/**/{test,__tests__,*.md,*.map,LICENSE*}"

asar: true
asarUnpack:
  - "node_modules/@codemirror/**"   # if any native binding needs unpack — usually not

linux:
  target:
    - AppImage
    - deb
  category: Office
  icon: build/icons/

mac:
  target:
    - dmg
    - zip
  icon: build/icon.icns
  category: public.app-category.productivity
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist

win:
  target:
    - target: nsis
      arch: [x64]
    - target: portable
      arch: [x64]
  icon: build/icon.ico

nsis:
  oneClick: false
  perMachine: false
  allowElevation: true
  allowToChangeInstallationDirectory: true

publish:
  provider: github
  owner: NathanLaan
  repo: noteliner
  releaseType: release
```

### Step 2: Asset generation

Generate per-OS icons from the existing `assets/icon.png`:

- **macOS `.icns`:** `iconutil` (mac-only). Source: 1024×1024 PNG → iconset
  → icns. Or use `electron-icon-builder` to derive all formats from one
  PNG cross-platform.
- **Windows `.ico`:** multi-resolution (16, 32, 48, 64, 128, 256). `png-to-ico`
  npm package or imagemagick.
- **Linux:** several PNG sizes in `build/icons/` (16, 32, 48, 64, 128, 256, 512).

Add a script `scripts/build-icons.js` that runs once and stages everything in
`build/icons/`.

### Step 3: Build scripts

**`package.json`:**

```json
"scripts": {
  "build:renderer": "vite build",
  "build:linux": "npm run build:renderer && electron-builder --linux",
  "build:win": "npm run build:renderer && electron-builder --win",
  "build:mac": "npm run build:renderer && electron-builder --mac",
  "build:all": "npm run build:renderer && electron-builder -mwl",
  "release": "npm run build:renderer && electron-builder --publish always"
}
```

The existing `dev` / `electron:dev` / `start` scripts are unchanged.

### Step 4: Auto-update wiring

```bash
npm install electron-updater
```

In `src/main/main.js`, after window creation:

```js
const { autoUpdater } = require('electron-updater');

if (!app.isPackaged) {
  // dev mode: skip
} else {
  autoUpdater.checkForUpdatesAndNotify().catch(err => {
    console.warn('autoUpdater:', err.message);
  });
  autoUpdater.on('update-available', () => log('Update available; downloading…'));
  autoUpdater.on('update-downloaded', () => log('Update ready; will install on next restart.'));
}
```

Hook log messages into the existing Log panel as well, so users have
visibility.

### Step 5: GitHub Actions workflow

**New file:** `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - name: Build & publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows signing
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
        run: npm run release
```

Notes:

- Tag a commit `vX.Y.Z` → workflow runs across all three runners → each
  uploads its artifacts to a draft GitHub Release named after the tag.
- `npm ci` (not `npm install`) for reproducible installs.
- `electron-builder` reads `package.json` `version` — keep it in sync with
  the tag (a `npm version` script handles both).

### Step 6: Versioning fix

Today, the displayed version is `${semver}.${shortHash}` injected at build
time via Vite's `define`. For released builds:

- The shortHash is fine for dev, but for tagged releases prefer the bare
  `vX.Y.Z` to match what GitHub Releases shows.
- Detect "is this a tagged build" via `process.env.GITHUB_REF` in CI and
  emit accordingly. Fall back to `${semver}-dev.${shortHash}` for local
  dev builds.

### Step 7: README + install instructions

Replace the README's "Development" section's prominence: add an
**Installation** section *above* it pointing at the latest release page,
with per-OS one-liners:

```
macOS:    Download the .dmg, drag NoteLiner to /Applications.
Windows:  Download the .exe installer, run.
Linux:    Download the .AppImage, chmod +x, run.
          Or: sudo dpkg -i noteliner_X.Y.Z_amd64.deb
```

Keep the dev instructions but mark them clearly as for contributors.

### Step 8: Smoke-test artifacts

After the first successful release run, manually:

1. Download each artifact on a fresh VM/clean machine.
2. Install. Launch. Open a project. Edit a note.
3. Verify:
   - macOS: no "unidentified developer" warning (signed + notarized works).
   - Windows: no SmartScreen warning beyond the one-time "More info → Run
     anyway" if EV cert isn't seasoned yet.
   - Linux: AppImage runs without `--no-sandbox` flag, deb installs and
     adds a desktop entry.

## Edge Cases

- **macOS notarization is async.** `electron-builder` polls; expect 5–20
  minute build times on macOS runner. Bake into release expectations.
- **Apple Silicon vs Intel:** `--arch=universal` produces a fat binary at
  ~2× size. v1 ships universal — fewer downloads to label.
- **First Windows release without an EV cert** still triggers SmartScreen
  reputation prompts. The cert needs ~50 user installs of "More info →
  Run anyway" to season. Document.
- **Linux desktop integration:** AppImage doesn't auto-register. Ship an
  AppImageLauncher recommendation in install docs, or include
  `appimaged`-friendly metadata (already part of electron-builder defaults).
- **Auto-update on Linux** only works for AppImage; deb does not auto-update
  (would need a PPA/repo). Document that deb users update manually.
- **`postinstall` hook (`scripts/install-desktop.sh`)** is a dev-time
  convenience that runs after `npm install`. It must not run in installed
  builds — `electron-builder` doesn't run package scripts on the built
  app, so this is fine, but verify the script is gated to "if you're
  in the source checkout."
- **electron-builder + native deps:** if any native module gets added later
  (e.g., `node-pty` from the AI plan), it'll need rebuilding per platform
  via `electron-builder install-app-deps`. Add a note in CONTRIBUTING.

## Security Considerations

- **Secrets in GitHub Actions:** code-signing certs as secrets, not in
  the repo. Rotate on team change.
- **Signed releases imply trust** — the public key on each platform is
  effectively saying "Anthropic^H^H^H NoteLiner author wrote this." Take
  releasing seriously; don't tag from a compromised laptop.
- **Auto-update fetches over HTTPS from GitHub** — `electron-updater`
  validates signatures against the publisher cert chain on macOS and
  Windows. On Linux (AppImage) it falls back to checksum verification —
  ensure `latest-linux.yml` is generated and uploaded.

## Testing

1. Cut a `v0.5.0-rc.1` tag → workflow runs end-to-end → artifacts appear
   in GitHub Releases as a draft.
2. Promote the draft to a release. Confirm `latest-mac.yml`,
   `latest-linux.yml`, `latest.yml` are present (the auto-update
   manifests).
3. Install the rc.1 build. Bump local app version to `0.5.0-rc.0` and
   confirm "update available" notification appears on next launch
   (manual stress-test of the autoUpdater path).
4. Apply the update. App restarts on `0.5.0-rc.1`. Project state intact.
5. Launch on a clean Windows VM with SmartScreen — should show "Verified
   publisher" if EV cert is seasoned, otherwise the one-time prompt.

## Out of Scope (V1)

- **Snap / Flatpak** packaging.
- **Microsoft Store** publishing (MSIX) — separate process, low ROI for
  a niche app.
- **Mac App Store** (MAS target) — sandbox restrictions complicate
  filesystem + git access.
- **Differential updates.** electron-updater supports deltas on macOS;
  enable later. v1 ships full updates.
- **Update channels** (stable / beta). Single channel for now.
- **In-app crash reporter / telemetry.** Privacy stance to be decided
  separately.

## Rollout

Cut `v0.5.0-rc.1` first; iterate the workflow with rcs until artifacts
install cleanly on all three OSes. Promote to `v0.5.0` when confident.
After that, every release follows: bump version, tag, push tag, GitHub
Release auto-publishes, users get prompted on next launch.
