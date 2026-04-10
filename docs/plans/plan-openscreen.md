# OpenScreen Redesign and New Project Modal

## Overview

Redesign the OpenScreen to be a proper landing page with left-aligned title, a button bar for New/Open Project, and a recent projects list. Add a "New Project" modal that collects project location, git user name, and email in one step, replacing the current multi-modal flow for new projects.

## Current Flow

1. User clicks "Open Folder" on OpenScreen
2. Native folder dialog opens
3. If folder is not a git repo → SetupModal appears (choose create/clone)
4. If git config missing → ProjectSettingsModal appears

The new flow for "New Project" consolidates this into a single modal with all required fields upfront.

## Implementation Steps

### Step 1: Backend - Recent projects and system info

**File:** `src/main/project-service.js`

1. **`getRecentProjects()`** — Read a `recent-projects.json` file from the Electron `userData` directory (not the project folder). Returns an array of `{ path, name, openedAt }` sorted by most recent. Max 5 entries.

2. **`addRecentProject(folderPath)`** — Add or update an entry in the recent projects list. Called whenever a project is successfully opened or created. Derives `name` from the folder name.

3. **`removeRecentProject(folderPath)`** — Remove an entry (if the folder no longer exists or user wants to clear it).

**File:** `src/main/main.js`

Add IPC handlers:

```
projects:getRecent    ()           -> [{ path, name, openedAt }]
projects:removeRecent (folderPath) -> void
system:getInfo        ()           -> { username, hostname, homeDir }
```

The `system:getInfo` handler uses Node's `os.userInfo()` and `os.hostname()` to provide defaults for the New Project modal.

**File:** `src/main/preload.js`

Expose on `window.api`:

```
getRecentProjects()
removeRecentProject(folderPath)
getSystemInfo()
```

### Step 2: Update OpenScreen layout

**File:** `src/renderer/components/OpenScreen.svelte`

Redesign from centered single-button layout to a top-left aligned landing page:

```
+-----------------------------------------------+
| NoteLiner                                      |
| An outliner for your thoughts                  |
|                                                |
| [New Project]  [Open Project]                  |
|                                                |
| RECENT PROJECTS                                |
| +-------------------------------------------+  |
| | My Notes           ~/docs/my-notes        |  |
| | Work Journal        ~/docs/work-journal   |  |
| | Research            ~/docs/research        |  |
| +-------------------------------------------+  |
+-----------------------------------------------+
```

**Props:**
- `onOpenFolder` — existing callback (renamed display text to "Open Project")
- `onNewProject` — new callback for the New Project button
- Recent projects fetched on mount via `window.api.getRecentProjects()`
- Clicking a recent project calls `onOpenFolder` equivalent directly with the path

**Recent projects list:**
- Each row shows the project name (derived from folder name) and the full path
- Clicking a row opens that project directly (no folder dialog needed)
- If the folder no longer exists, show it as disabled/greyed with a remove button
- Empty state: "No recent projects" message

### Step 3: New Project modal

**New file:** `src/renderer/components/NewProjectModal.svelte`

A modal dialog that collects all information needed to create a new project.

**Layout:**
```
+------------------------------------------+
| NEW PROJECT                              |  <- modal-header
+------------------------------------------+
| Project Location:                        |
| [ ~/docs/new-project-2026-04-10 ] [📁]  |
|                                          |
| User Name:                               |
| [ username                           ]   |
|                                          |
| User Email:                              |
| [ username@hostname                  ]   |
|                                          |
|                    [Cancel]  [OK]        |
+------------------------------------------+
```

**Behavior:**
- On mount, fetch system info via `window.api.getSystemInfo()` to populate defaults:
  - Location: `~/docs/new-project-YYYY-MM-DD` (using home directory from system info and today's date)
  - User Name: `os.userInfo().username`
  - User Email: `username@hostname`
- The folder button `[📁]` opens a native folder dialog and replaces the location field value
- OK button:
  1. Validate all fields non-empty
  2. Create the directory if it doesn't exist (`mkdir -p` via new IPC)
  3. Call `onConfirm({ folderPath, name, email })`
- Cancel / Escape: close without action
- Enter key triggers OK (default action)

### Step 4: App integration

**File:** `src/renderer/App.svelte`

1. Add `showNewProject` state variable.
2. Add `handleNewProject()` to show the modal.
3. Add `handleNewProjectConfirm({ folderPath, name, email })`:
   - Call `window.api.initProject(folderPath, '')` to create the repo
   - Call `window.api.setGitConfig(name, email)` to set git config
   - Load the project into state
   - Do NOT show ProjectSettingsModal (config already set)
4. Add `handleOpenRecentProject(folderPath)`:
   - Same as `handleOpenFolder` but skips the folder dialog, goes directly to `window.api.openProject(folderPath)`
5. Pass new callbacks to OpenScreen: `onNewProject`, `onOpenRecent`
6. Render NewProjectModal conditionally.
7. Call `addRecentProject` after every successful project load.

### Step 5: Backend - Create directory IPC

**File:** `src/main/main.js`

Add an IPC handler to ensure a directory exists:

```
fs:ensureDir (dirPath) -> void
```

This is needed because the New Project modal lets the user type a path that may not exist yet. Uses `fs.mkdirSync(dirPath, { recursive: true })`.

**File:** `src/main/preload.js`

Expose `ensureDir(dirPath)` on `window.api`.

## File Change Summary

| File | Change |
|---|---|
| `src/main/project-service.js` | `getRecentProjects`, `addRecentProject`, `removeRecentProject` |
| `src/main/main.js` | 4 new IPC handlers (`projects:getRecent`, `projects:removeRecent`, `system:getInfo`, `fs:ensureDir`) |
| `src/main/preload.js` | 4 new API methods |
| `src/renderer/components/OpenScreen.svelte` | Redesigned layout with button bar and recent projects list |
| `src/renderer/components/NewProjectModal.svelte` | **New file** |
| `src/renderer/App.svelte` | New state, handlers, modal rendering, recent project tracking |

## Design Decisions

1. **Recent projects stored in userData, not project folder.** The recent projects list is a user-level setting, not project-level. It belongs in Electron's `app.getPath('userData')` directory alongside other app state.
2. **Max 5 recent projects.** Keeps the list concise. Oldest entries are evicted when the limit is reached.
3. **New Project modal replaces SetupModal for new projects.** The SetupModal "Create New Repository" path is now handled by the New Project modal with better defaults. The SetupModal "Clone from Remote" path remains for cloning existing repos via Open Project.
4. **Default path uses `~/docs/` prefix.** A sensible default that users can change. The date suffix avoids collisions.
5. **System info for defaults.** Using `os.userInfo()` and `os.hostname()` provides reasonable pre-filled values that the user can edit.
