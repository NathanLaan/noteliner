# Remote Sync — Enhancements

## Overview

Two enhancements to the existing Remote Sync modal:

1. **Disconnect confirmation** — The "Disconnect remote" button (x next to URL) now opens a compact confirmation dialog before removing the remote.
2. **Reset from remote** — A new "Reset from Remote" button overwrites the local repository with the latest version from the remote. Opens a compact confirmation dialog with a strong warning before executing.

Both confirmation dialogs use the `.modal-overlay-compact` / `.modal-compact` style (centered, auto-sized, not full-window).

## Current State

- **SyncModal.svelte** — Has `handleDisconnect()` which directly calls `gitRemoveRemote()` with no confirmation. Has Pull/Push buttons but no "force overwrite" option.
- **git-service.js** — Has `removeRemote()`, `push()`, `pull()`. Does not have a `resetToRemote()` or `fetchAndReset()` method.
- **Compact modal pattern** — `.modal-overlay-compact` and `.modal-compact` already exist in `global.css` (added for RemoveRecentModal).

## Design

### Disconnect confirmation

When the user clicks the `[x]` disconnect button next to the Remote URL, a compact modal appears:

```
+------------------------------------------+
| DISCONNECT REMOTE                        |
+------------------------------------------+
|                                          |
| Disconnect from the remote repository?   |
|                                          |
| https://github.com/user/repo.git         |
|                                          |
| Your local files will not be deleted.    |
|                                          |
|                   [Cancel]  [Disconnect]  |
+------------------------------------------+
```

Cancel dismisses. Disconnect calls `gitRemoveRemote()` and clears the URL/status.

### Reset from remote

A new button in the sync actions area: "Reset from Remote" with a warning-colored style. Only visible when a remote is configured.

When clicked, a compact confirmation modal appears:

```
+-------------------------------------------+
| RESET FROM REMOTE                         |
+-------------------------------------------+
|                                           |
| ⚠ This will discard ALL local changes    |
| and replace your project with the latest  |
| version from the remote repository.       |
|                                           |
| This action cannot be undone.             |
|                                           |
|                    [Cancel]  [Reset]       |
+-------------------------------------------+
```

The "Reset" button is styled red (destructive action).

### Git command for reset

The most appropriate git command sequence:

```
git fetch origin
git reset --hard origin/<branch>
```

`git fetch origin` updates remote refs without touching the working tree. `git reset --hard origin/<branch>` moves HEAD to the remote's latest commit and overwrites the working tree and index entirely. This is the standard way to force-overwrite local with remote.

After reset, the project's `noteliner.json` may have changed, so the renderer must reload the project index.

## Implementation Steps

### Step 1: Git service — Add resetToRemote method

**File:** `src/main/git-service.js`

```js
async resetToRemote(folderPath, branch) {
  await this.exec(['fetch', 'origin'], folderPath);
  return await this.exec(['reset', '--hard', `origin/${branch}`], folderPath);
}
```

### Step 2: IPC handler and preload

**File:** `src/main/main.js`

```js
ipcMain.handle('git:resetToRemote', async () => {
  if (!projectService.projectPath) return;
  const branch = await gitService.getCurrentBranch(projectService.projectPath);
  await gitService.resetToRemote(projectService.projectPath, branch);
  // Reload the index since it may have changed
  const indexPath = path.join(projectService.projectPath, 'noteliner.json');
  if (fs.existsSync(indexPath)) {
    projectService.index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return { index: projectService.index };
});
```

**File:** `src/main/preload.js`

```js
gitResetToRemote: () => ipcRenderer.invoke('git:resetToRemote'),
```

### Step 3: SyncModal — Add inline confirmation modals and reset button

**File:** `src/renderer/components/SyncModal.svelte`

Add local state for the two confirmation dialogs:

```js
let showDisconnectConfirm = $state(false);
let showResetConfirm = $state(false);
```

**Disconnect flow change:**
- The `[x]` button now sets `showDisconnectConfirm = true` instead of calling `handleDisconnect()` directly.
- A compact confirmation dialog renders inside SyncModal (using `.modal-overlay-compact` / `.modal-compact`).
- Confirm calls `handleDisconnect()` then closes the dialog.
- Cancel just closes the dialog.

**Reset from Remote button:**
- Added to the sync actions area, after Pull/Push.
- Styled as a warning/destructive action (text color or subtle red styling).
- Clicking sets `showResetConfirm = true`.
- A compact confirmation dialog with a strong warning renders inside SyncModal.
- Confirm calls `handleResetFromRemote()`:
  ```js
  async function handleResetFromRemote() {
    showResetConfirm = false;
    error = '';
    operating = 'Resetting...';
    try {
      const result = await window.api.gitResetToRemote();
      if (result && result.index) {
        projectState.load(projectState.folderPath, result.index);
      }
      await refreshStatus();
    } catch (err) {
      error = `Reset failed: ${err.message}`;
    } finally {
      operating = '';
    }
  }
  ```
- After reset, `projectState.load()` reloads the index in the renderer (since the file tree may have changed).

### Step 4: Updated SyncModal layout

```
+----------------------------------------------+
| REMOTE SYNC                                  |
+----------------------------------------------+
|                                              |
| Remote URL:                                  |
| [ https://github.com/user/repo.git    ] [x]  |
|                                              |
| Branch: main                                 |
|                                              |
| Status: [*] Synced                           |
|                                              |
| [Pull]  [Push]  [Reset from Remote]  [Close] |
+----------------------------------------------+
```

The "Reset from Remote" button is visually distinct — muted/warning style to signal it's destructive.

## File Change Summary

| File | Change |
|---|---|
| `src/main/git-service.js` | Add `resetToRemote(folderPath, branch)` method |
| `src/main/main.js` | Add `git:resetToRemote` IPC handler (fetches, resets, reloads index) |
| `src/main/preload.js` | Add `gitResetToRemote` API method |
| `src/renderer/components/SyncModal.svelte` | Add disconnect confirmation, reset button + confirmation, inline compact modals |

## Design Decisions

1. **Inline compact modals within SyncModal.** The confirmations render inside the SyncModal component itself (as overlapping `.modal-overlay-compact` dialogs). This keeps the confirmation state local to SyncModal — no App.svelte wiring needed.

2. **`git fetch` + `git reset --hard` for remote reset.** This is the standard, well-understood git idiom for "make local match remote exactly." It's a single atomic operation after fetch — no merge conflicts, no ambiguity. The `--hard` flag ensures both index and working tree are overwritten.

3. **Reload index after reset.** The `noteliner.json` file may have changed after reset. The IPC handler reads it fresh from disk and returns it, so the renderer can call `projectState.load()` to refresh the file tree.

4. **Red/warning styling for Reset button.** The button is destructive and irreversible (local commits are lost). A visual distinction prevents accidental clicks. The confirmation dialog reinforces this with explicit warning text.

5. **Compact modal for confirmations.** Both confirmations are simple yes/no decisions that don't need the full-window modal treatment. The `.modal-overlay-compact` style centers a small dialog over the existing SyncModal, creating a clear layered UI.
