# Git Config Detection and Project Settings

## Problem

When a git repository doesn't have `user.name` and `user.email` configured (either locally or globally), every `git commit` fails with:

```
fatal: unable to auto-detect email address
```

Since noteliner auto-commits on every file save, write, rename, and delete, this silently breaks all persistence. The user sees no indication that their work isn't being committed.

## Solution

1. Detect missing git config when a project is opened or initialized.
2. If `user.name` or `user.email` is missing, prompt the user via a new **Project Settings** modal to configure them.
3. Apply the values as local repo-level git config (`git config user.name` / `git config user.email`).
4. Make the Project Settings modal accessible from the toolbar at any time so users can review or change these values later.

## Implementation Steps

### Step 1: Backend - GitService config methods

**File:** `src/main/git-service.js`

Add three new methods:

1. **`getConfig(folderPath, key)`** — Runs `git config --local <key>`, falls back to `git config <key>` (global). Returns the value or `null` if unset.

2. **`setConfig(folderPath, key, value)`** — Runs `git config --local <key> <value>` to set repo-level config.

3. **`checkConfig(folderPath)`** — Returns `{ name, email }` by reading `user.name` and `user.email`. Values are `null` if not configured at any level (local or global).

### Step 2: Backend - ProjectService config check

**File:** `src/main/project-service.js`

1. Add a `getGitConfig()` method that delegates to `gitService.checkConfig(this.projectPath)`.

2. Add a `setGitConfig(name, email)` method that calls `gitService.setConfig()` for both values.

3. In `openProject()` and `initProject()`, after the project is loaded, check git config. If either `user.name` or `user.email` is missing, return an additional field in the result: `needsGitConfig: true` alongside the current `status: 'loaded'` response.

**Updated return shape:**
```js
{ status: 'loaded', index: this.index, needsGitConfig: true }
```

This keeps the project usable (files can be read) while signaling that commits will fail until config is set.

### Step 3: Backend - IPC handlers

**File:** `src/main/main.js`

Add two new IPC handlers:

```
git:getConfig   ()              -> { name: string|null, email: string|null }
git:setConfig   (name, email)   -> void
```

**File:** `src/main/preload.js`

Expose on `window.api`:

```
getGitConfig()
setGitConfig(name, email)
```

### Step 4: Frontend - ProjectSettingsModal component

**New file:** `src/renderer/components/ProjectSettingsModal.svelte`

A modal dialog following the existing modal pattern (header with background, body, footer).

**Layout:**
```
+----------------------------------+
| PROJECT SETTINGS                 |  <- modal-header
+----------------------------------+
| Git Configuration                |
|                                  |
| User Name                        |
| [ ____________________________ ] |
|                                  |
| User Email                       |
| [ ____________________________ ] |
|                                  |
|                           [ OK ] |
+----------------------------------+
```

**Behavior:**
- On mount, fetch current values via `window.api.getGitConfig()` and populate the input fields.
- On OK: validate that both fields are non-empty, call `window.api.setGitConfig(name, email)`, then close.
- On Escape: close without saving (same as all other modals).
- Enter key triggers OK (same as all other modals).
- If opened because `needsGitConfig` is true (first-time prompt), show an info message above the fields: "Git requires a name and email to save changes. These are stored in the local repository config."

### Step 5: Frontend - App integration

**File:** `src/renderer/App.svelte`

1. Add `showProjectSettings` state variable.
2. Add `projectSettingsRequired` state variable (true when opened due to missing config, false when opened manually from toolbar).
3. In `handleOpenFolder()` and `handleSetupComplete()`, after receiving a `loaded` result, check `result.needsGitConfig`. If true, set `projectSettingsRequired = true` and `showProjectSettings = true`.
4. Add `handleShowProjectSettings()` and `handleProjectSettingsClose()` functions.
5. Render `ProjectSettingsModal` conditionally.
6. Pass `projectSettingsRequired` to the modal so it can show the info message when appropriate.

### Step 6: Frontend - Toolbar button

**File:** `src/renderer/components/Toolbar.svelte`

Add a new button, visible only when a project is open:

- **Icon:** `fa-sliders` (project/config icon)
- **Tooltip:** `"Project Settings (Ctrl+Shift+,)"`
- **Position:** Below the attachments button, above the spacer.

### Step 7: Keyboard shortcut

**File:** `src/renderer/App.svelte`

Add `Ctrl+Shift+,` to the global keydown handler to open Project Settings.

**Rationale:** `Ctrl+,` is already Settings (app theme). `Ctrl+Shift+,` is a natural pairing for project-level settings.

### Step 8: Error resilience in commit

**File:** `src/main/git-service.js`

Update `commit()` to detect the specific "unable to auto-detect email address" error and return a structured error that the renderer can recognize, rather than silently failing or throwing a generic error.

**File:** `src/main/main.js`

In the `file:write`, `file:create`, `file:delete`, `file:rename` IPC handlers, catch commit failures due to missing git config and return `{ error: 'git_config_required' }` to the renderer. This allows the frontend to automatically show the Project Settings modal if a save fails for this reason.

## File Change Summary

| File | Change |
|---|---|
| `src/main/git-service.js` | `getConfig`, `setConfig`, `checkConfig` methods; improved commit error detection |
| `src/main/project-service.js` | `getGitConfig`, `setGitConfig` methods; config check on open/init |
| `src/main/main.js` | 2 new IPC handlers; error handling in file operation handlers |
| `src/main/preload.js` | 2 new API methods |
| `src/renderer/components/ProjectSettingsModal.svelte` | **New file** |
| `src/renderer/components/Toolbar.svelte` | New button |
| `src/renderer/App.svelte` | State, modal rendering, keyboard shortcut, config-required flow |

## Design Decisions

1. **Local repo config, not global:** Setting config at the repo level (`--local`) avoids modifying the user's global git config, which could affect other projects.
2. **Non-blocking on open:** The project still loads even if git config is missing. The user can read files and browse the tree. Only commits are blocked. The modal prompts them to fix it immediately.
3. **Automatic re-prompt on save failure:** If the user dismisses the modal without configuring, the next save failure will re-trigger the prompt rather than silently losing data.
