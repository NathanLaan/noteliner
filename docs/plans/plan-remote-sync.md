# Remote Sync

## Overview

Add a "Remote Sync" feature that lets users configure a remote Git URL (GitHub/GitLab), manually push/pull, and see the sync status of their project. This surfaces the existing `git-service.js` push/pull/remote capabilities through a dedicated UI instead of relying on the silent background auto-push.

## Current State

The app already has significant git plumbing in place:

- **`git-service.js`** — `push()`, `pull()`, `addRemote()`, `hasRemote()`, `schedulePush()` (30s debounced auto-push after every file save)
- **`project-service.js`** — Every file write/create/delete/rename calls `commit()` then `schedulePush()`. Opening an existing project calls `pull()`.
- **`preload.js`** — Exposes `gitPush()` and `gitPull()` to the renderer.
- **Auto-push** — Already works silently if a remote exists, but the user has no way to configure the remote from the UI, no visibility into sync state, and no manual push/pull controls.

The gap: there is no UI to set up a remote, trigger sync on demand, or see whether local and remote have diverged.

## Implementation Steps

### Step 1: Backend — New git-service methods

**File:** `src/main/git-service.js`

Add methods to support the sync modal:

1. **`getRemoteUrl(folderPath)`** — Run `git remote get-url origin`. Returns the URL string or `null` if no remote.

2. **`setRemoteUrl(folderPath, url)`** — If origin exists, run `git remote set-url origin <url>`. If not, run `git remote add origin <url>`. This replaces the current `addRemote()` which fails if origin already exists.

3. **`removeRemote(folderPath)`** — Run `git remote remove origin`.

4. **`getSyncStatus(folderPath)`** — Determine local vs remote divergence:
   - Run `git fetch origin` (silent, to update remote refs without merging).
   - Run `git rev-parse HEAD` to get local commit hash.
   - Run `git rev-parse @{u}` (upstream tracking ref) to get remote commit hash. If this fails, there is no upstream — return `{ status: 'no-upstream' }`.
   - Run `git merge-base HEAD @{u}` to find the common ancestor.
   - Compare the three hashes:
     - local == remote → `{ status: 'synced' }`
     - base == remote → `{ status: 'ahead', count: N }` (local has commits not on remote)
     - base == local → `{ status: 'behind', count: N }` (remote has commits not on local)
     - Otherwise → `{ status: 'diverged', ahead: N, behind: N }`
   - Use `git rev-list --count` for commit counts.
   - Wrap the whole thing in a try/catch — network errors return `{ status: 'error', message: '...' }`.

5. **`getCurrentBranch(folderPath)`** — Run `git branch --show-current`. Returns branch name string.

6. **`setUpstreamAndPush(folderPath, branch)`** — Run `git push -u origin <branch>`. This is needed the first time a local repo pushes to a newly configured remote.

### Step 2: Backend — New IPC handlers

**File:** `src/main/main.js`

Add handlers that delegate to git-service and project-service:

```
git:getRemoteUrl   ()         -> string | null
git:setRemoteUrl   (url)      -> void
git:removeRemote   ()         -> void
git:getSyncStatus  ()         -> { status, count?, ahead?, behind?, message? }
git:getBranch      ()         -> string
git:pushUpstream   ()         -> void
```

All handlers should use `projectService.projectPath` as the folder path (same pattern as existing `git:push` / `git:pull` handlers).

**File:** `src/main/preload.js`

Expose on `window.api`:

```js
gitGetRemoteUrl:  () => ipcRenderer.invoke('git:getRemoteUrl'),
gitSetRemoteUrl:  (url) => ipcRenderer.invoke('git:setRemoteUrl', url),
gitRemoveRemote:  () => ipcRenderer.invoke('git:removeRemote'),
gitGetSyncStatus: () => ipcRenderer.invoke('git:getSyncStatus'),
gitGetBranch:     () => ipcRenderer.invoke('git:getBranch'),
gitPushUpstream:  () => ipcRenderer.invoke('git:pushUpstream'),
```

### Step 3: Sync toolbar button

**File:** `src/renderer/components/Toolbar.svelte`

Add a Sync button in the project-open section, between the Attachments button and the spacer:

```svelte
<button class="toolbar-btn" onclick={onShowSync} title="Remote Sync (Ctrl+Shift+S)">
  <i class="fas fa-cloud-arrow-up"></i>
</button>
```

The `fa-cloud-arrow-up` icon communicates "cloud sync" clearly. Alternative: `fa-arrows-rotate` for a more generic sync look.

Add `onShowSync` to the destructured props.

### Step 4: Remote Sync modal

**New file:** `src/renderer/components/SyncModal.svelte`

A modal dialog for configuring and triggering remote sync.

**Layout — No remote configured:**

```
+----------------------------------------------+
| REMOTE SYNC                                  |
+----------------------------------------------+
|                                              |
| No remote repository configured.             |
|                                              |
| Remote URL:                                  |
| [ https://github.com/user/repo.git    ]      |
|                                              |
| Branch: main                                 |
|                                              |
|                        [Cancel]  [Connect]    |
+----------------------------------------------+
```

**Layout — Remote configured and synced:**

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
| Status: [*] Synced — local and remote match  |
|                                              |
| [Pull]  [Push]              [Close]           |
+----------------------------------------------+
```

**Layout — Diverged state:**

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
| Status: [!] Local is 3 commits ahead         |
|                                              |
| [Pull]  [Push]              [Close]           |
+----------------------------------------------+
```

**Behavior:**

- **On mount:** Fetch `gitGetRemoteUrl()`, `gitGetBranch()`. If remote exists, also fetch `gitGetSyncStatus()`.
- **Remote URL field:** Editable text input. The `[x]` button calls `gitRemoveRemote()` to disconnect.
- **Connect button:** Calls `gitSetRemoteUrl(url)`, then `gitPushUpstream()` (to set upstream tracking), then refreshes status.
- **Pull button:** Calls `gitPull()`, then refreshes status. Show a spinner/progress indicator while running.
- **Push button:** Calls `gitPush()`, then refreshes status. Show spinner while running.
- **Status indicator:** A colored dot + text:
  - Green dot + "Synced" for `synced`
  - Blue dot + "N commits ahead" for `ahead`
  - Orange dot + "N commits behind" for `behind`
  - Red dot + "Diverged (N ahead, N behind)" for `diverged`
  - Grey dot + "No upstream configured" for `no-upstream`
  - Red dot + error message for `error`
- **Refresh button** (small icon next to status): Re-runs `gitGetSyncStatus()`.
- **Progress feedback:** While push/pull is running, disable buttons and show "Pushing..." or "Pulling..." text. The existing `onGitLog` event stream will also show progress in the Log Panel if it's open.

**Keyboard handling:**
- Escape closes the modal.
- No Enter-to-submit (too dangerous — accidental push/pull).

**Style:** Follow the existing modal patterns from `ProjectSettingsModal.svelte` — same overlay, border-radius, header/body structure, CSS variable usage.

### Step 5: App integration

**File:** `src/renderer/App.svelte`

1. Add `showSync` state: `let showSync = $state(false);`
2. Add handler: `function handleShowSync() { showSync = true; }`
3. Add keyboard shortcut in the `handleKeydown` function:
   ```js
   } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
     e.preventDefault();
     if (projectState.isOpen) showSync = true;
   }
   ```
4. Import and render the modal:
   ```svelte
   {#if showSync}
     <SyncModal onClose={() => showSync = false} />
   {/if}
   ```
5. Pass `onShowSync={handleShowSync}` to the Toolbar component.

## Hostname Branch Strategy — Pros and Cons

The question: should noteliner automatically create a branch named after the local hostname (e.g., `desktop-PC`, `laptop`) so that each device works on its own branch?

### Pros

1. **No merge conflicts.** Each device pushes to its own branch, so concurrent edits on different machines never conflict on push.
2. **Full history per device.** You can see exactly what changed on each machine independently.
3. **Data safety.** Even if merging fails, no work is lost — each branch is a complete snapshot of that device's state.

### Cons

1. **Merge is still required.** Branches don't sync themselves. You'd need a merge step (either manual or automatic) to unify changes, which is the hard part. This just defers the conflict rather than solving it.
2. **Complexity for the user.** Noteliner targets note-taking, not software development. Exposing branches, merges, and divergent states to non-technical users is confusing.
3. **Stale branches accumulate.** Old hostnames (renamed machines, temporary devices) leave orphan branches that clutter the remote.
4. **The common case doesn't need it.** Most users edit on one device at a time. The current linear main-branch model with auto-push/pull-on-open handles this well. Branches add complexity for an edge case.
5. **Merge automation is fragile.** Auto-merging `noteliner.json` (the index file) is non-trivial — it's a JSON file with UUIDs and ordering. Git's text merge will produce conflicts or corrupt JSON on concurrent structural changes (reorder, add, delete). You'd need a custom merge driver or application-level conflict resolution.

### Recommendation

**Don't use hostname branches for v1.** Instead, rely on the existing single-branch model (`main`) with these safeguards:

- **Pull before push.** The sync modal's Push action should pull first (`git pull --rebase`), then push. This handles the 90% case where edits are sequential across devices.
- **Conflict detection.** If pull fails due to conflicts, show a clear error in the sync modal rather than silently corrupting data. The user can then use the Log Panel or an external git tool to resolve.
- **Future option.** If multi-device concurrent editing becomes a real need, consider a proper CRDT or operational-transform approach at the document level rather than git branching, since the problem is fundamentally about data merging, not version control.

If the hostname branch approach is still desired as a future option, it could be added as an opt-in setting in the sync modal (a "Branch per device" toggle) without affecting the default flow.

## File Change Summary

| File | Change |
|---|---|
| `src/main/git-service.js` | Add `getRemoteUrl`, `setRemoteUrl`, `removeRemote`, `getSyncStatus`, `getCurrentBranch`, `setUpstreamAndPush` |
| `src/main/main.js` | 6 new IPC handlers |
| `src/main/preload.js` | 6 new API methods |
| `src/renderer/components/Toolbar.svelte` | Add Sync button with `onShowSync` prop |
| `src/renderer/components/SyncModal.svelte` | **New file** — Remote sync modal |
| `src/renderer/App.svelte` | New state, handler, keyboard shortcut, modal rendering, Toolbar prop |

## Design Decisions

1. **Modal, not a panel.** Sync is an infrequent, deliberate action. A modal focuses attention and avoids cluttering the always-visible layout. The Log Panel already provides ongoing sync visibility.
2. **Manual push/pull, not just auto-sync.** The existing auto-push works well for single-device use, but multi-device needs explicit control. Users should see the state and choose when to sync, especially when there's divergence.
3. **Single remote (origin).** Noteliner doesn't need multi-remote support. One origin is enough. The URL field edits origin's URL directly.
4. **`git fetch` for status checks.** Fetch updates remote refs without modifying the working tree, making it safe to call any time for status display.
5. **No hostname branching in v1.** See analysis above. The complexity cost outweighs the benefit for the target use case.
6. **Ctrl+Shift+S shortcut.** Mnemonically "Sync" while avoiding conflict with Ctrl+S (which isn't used — files auto-save — but is a muscle-memory hazard).
