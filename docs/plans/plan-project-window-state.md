# Per-Project Window State Persistence

## Overview

Save and restore window position, size, and UI layout per project. When a user opens a project, the window and all panels restore to exactly how they left them.

## Current State

**UI state variables in App.svelte (lines 20-38):** 18 individual `$state` variables — 9 are persistable layout state, the rest are transient modal/action state.

| Variable | Default | Persist? |
|---|---|---|
| `showPreview` | `false` | Yes |
| `showLog` | `false` | Yes |
| `showSidebar` | `true` | Yes |
| `showOutline` | `false` | Yes |
| `showTagGroups` | `false` | Yes |
| `showAttachments` | `false` | Yes |
| `logPanelHeight` | `300` | Yes |
| `sidebarWidth` | `260` | Yes |
| `attachmentPanelWidth` | `220` | Yes |
| `showAbout`, `showSetup`, `showSettings`, etc. | — | No (transient modals) |
| `tagAction`, `setupFolderPath`, `projectSettingsRequired` | — | No (transient) |

**Sidebar internal state (Sidebar.svelte lines 14-17):** Three pane heights that are local to Sidebar and not exposed to App.svelte:
- `tagGroupsHeight` = 150
- `outlineHeight` = 150
- `tagsHeight` = 100

**Window bounds:** Not persisted at all. BrowserWindow always opens at 1200x800 (main.js line 51-52).

**Theme state:** Persisted globally via localStorage (`noteliner-theme`, `noteliner-scale`). Not per-project — keep as-is.

## Issues to Address

1. **Sidebar pane heights are local.** They're `$state` variables inside Sidebar.svelte, not exposed as props. To persist them, they need to be lifted to App.svelte or managed through a store.

2. **`bind:width` on Sidebar doesn't work.** App.svelte passes `bind:width={sidebarWidth}` but Sidebar doesn't declare a `width` prop. The binding is silently ignored. Remove it.

3. **Too many loose state variables in App.svelte.** 18 individual `$state` variables make persistence awkward (serialize/deserialize each one). Grouping the persistable ones into a single object would simplify save/restore.

4. **No window bounds tracking.** The Electron main process doesn't save or restore window position/size.

## Design

### Storage location

Store window state in `{userData}/window-state.json`, keyed by project folder path. This avoids adding UI metadata to the project's `noteliner.json` (which is git-tracked and shared between machines — UI layout is personal, not collaborative).

```json
{
  "/home/user/docs/my-notes": {
    "bounds": { "x": 100, "y": 50, "width": 1400, "height": 900 },
    "isMaximized": false,
    "layout": {
      "showPreview": false,
      "showLog": true,
      "showSidebar": true,
      "showOutline": true,
      "showTagGroups": false,
      "showAttachments": false,
      "sidebarWidth": 280,
      "logPanelHeight": 250,
      "attachmentPanelWidth": 220,
      "tagGroupsHeight": 150,
      "outlineHeight": 150,
      "tagsHeight": 100
    }
  },
  "/home/user/docs/work-journal": { ... }
}
```

### Data flow

**Save (debounced, on any layout change):**
1. App.svelte layout state changes (panel toggle, resize, etc.)
2. Debounced call to `window.api.saveWindowState(folderPath, state)`
3. Main process writes to `window-state.json`

**Save window bounds (on move/resize/close):**
1. Main process listens for BrowserWindow `resize`, `move`, `close` events
2. Debounced save of bounds to `window-state.json` keyed by current project path

**Restore (on project open):**
1. `loadProject()` in App.svelte calls `window.api.getWindowState(folderPath)`
2. Returns the saved layout (or `null` for defaults)
3. App.svelte applies layout state to its variables
4. App.svelte calls `window.api.restoreWindowBounds(folderPath)` to resize/reposition the Electron window

## Implementation Steps

### Step 1: Refactor — Lift Sidebar pane heights to App.svelte

**File:** `src/renderer/components/Sidebar.svelte`

Change `tagGroupsHeight`, `outlineHeight`, `tagsHeight` from local `$state` to props:

```js
let { tagAction = null, outlineVisible = false, tagGroupsVisible = false,
      tagGroupsHeight = 150, outlineHeight = 150, tagsHeight = 100,
      onPaneResize } = $props();
```

Replace the resizer's setter to call `onPaneResize(paneName, newHeight)` instead of setting local state directly.

**File:** `src/renderer/App.svelte`

Add the three height states and pass them as props to Sidebar. Add a `handlePaneResize` callback.

Remove the non-functional `bind:width={sidebarWidth}` from the Sidebar element.

### Step 2: Refactor — Group layout state

**File:** `src/renderer/App.svelte`

Replace the 12 individual layout `$state` variables with a single reactive object:

```js
const DEFAULT_LAYOUT = {
  showPreview: false,
  showLog: false,
  showSidebar: true,
  showOutline: false,
  showTagGroups: false,
  showAttachments: false,
  sidebarWidth: 260,
  logPanelHeight: 300,
  attachmentPanelWidth: 220,
  tagGroupsHeight: 150,
  outlineHeight: 150,
  tagsHeight: 100,
};

let layout = $state({ ...DEFAULT_LAYOUT });
```

Update all references: `showLog` → `layout.showLog`, `sidebarWidth` → `layout.sidebarWidth`, etc. Update all toggle handlers, prop bindings, and template expressions.

Keep transient modal states (`showAbout`, `showSettings`, etc.) as separate `$state` variables — they don't need persistence.

### Step 3: Backend — Window state service

**File:** `src/main/window-state-service.js` (new)

```js
class WindowStateService {
  constructor(filePath) { this.filePath = filePath; this.data = {}; }
  load()                              // Read from disk, parse JSON
  save()                              // Write to disk
  getLayout(folderPath)               // Returns layout object or null
  setLayout(folderPath, layout)       // Merges layout, debounced save
  getBounds(folderPath)               // Returns { bounds, isMaximized } or null
  setBounds(folderPath, bounds, isMaximized)  // Debounced save
}
```

Store file at `app.getPath('userData') + '/window-state.json'`.

Debounce writes by 1 second to avoid excessive disk I/O during resize drags.

### Step 4: Backend — IPC handlers and preload

**File:** `src/main/main.js`

Add IPC handlers:

```
window-state:getLayout   (folderPath)          -> layout object | null
window-state:saveLayout  (folderPath, layout)   -> void
window-state:restoreBounds (folderPath)         -> void (resizes BrowserWindow)
```

Add window bounds tracking:

```js
// After createWindow():
mainWindow.on('resize', debounced(() => saveBounds()));
mainWindow.on('move', debounced(() => saveBounds()));
mainWindow.on('close', () => saveBoundsSync());
```

On `restoreBounds`: read saved bounds, validate they're on a visible screen (monitor may have changed), then apply via `mainWindow.setBounds()` / `mainWindow.maximize()`.

**File:** `src/main/preload.js`

Expose:

```js
getWindowState:    (folderPath) => ipcRenderer.invoke('window-state:getLayout', folderPath),
saveWindowState:   (folderPath, layout) => ipcRenderer.invoke('window-state:saveLayout', folderPath, layout),
restoreWindowBounds: (folderPath) => ipcRenderer.invoke('window-state:restoreBounds', folderPath),
```

### Step 5: Frontend — Save layout on change

**File:** `src/renderer/App.svelte`

Add a debounced `$effect` that watches `layout` and saves:

```js
let saveTimer = null;
$effect(() => {
  // Read all layout fields to track them
  const snapshot = { ...layout };
  if (!projectState.isOpen) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.api.saveWindowState(projectState.folderPath, snapshot);
  }, 1000);
});
```

### Step 6: Frontend — Restore layout on project open

**File:** `src/renderer/App.svelte`

Update `loadProject()`:

```js
async function loadProject(folderPath, result) {
  if (result.status === 'loaded') {
    projectState.load(folderPath, result.index);
    window.api.addRecentProject(folderPath);

    // Restore saved layout
    const saved = await window.api.getWindowState(folderPath);
    if (saved) {
      layout = { ...DEFAULT_LAYOUT, ...saved };
    } else {
      layout = { ...DEFAULT_LAYOUT };
    }

    // Restore window bounds
    window.api.restoreWindowBounds(folderPath);

    if (result.needsGitConfig) {
      projectSettingsRequired = true;
      showProjectSettings = true;
    }
  }
}
```

### Step 7: Window bounds — Restore on open, validate screen

**File:** `src/main/main.js`

The `restoreBounds` handler must validate that saved bounds are on a visible display (the user may have changed monitors):

```js
const { screen } = require('electron');

function isVisibleOnAnyDisplay(bounds) {
  const displays = screen.getAllDisplays();
  return displays.some(d => {
    const db = d.bounds;
    return bounds.x < db.x + db.width && bounds.x + bounds.width > db.x
        && bounds.y < db.y + db.height && bounds.y + bounds.height > db.y;
  });
}
```

If bounds are off-screen, center the window on the primary display instead.

## File Change Summary

| File | Change |
|---|---|
| `src/main/window-state-service.js` | **New file** — Read/write/debounce window state JSON |
| `src/main/main.js` | Window bounds tracking, 3 new IPC handlers, screen validation |
| `src/main/preload.js` | 3 new API methods |
| `src/renderer/App.svelte` | Group layout into single object, save/restore on project open/change, remove `bind:width` |
| `src/renderer/components/Sidebar.svelte` | Lift pane heights to props, add `onPaneResize` callback |

## Design Decisions

1. **Separate file, not in noteliner.json.** The project index is git-tracked and synced between machines. UI layout is personal preference — it doesn't belong in version control. A separate `window-state.json` in Electron's `userData` directory keeps them independent.
2. **Keyed by folder path.** Simple and unique. If the user moves a project folder, they lose the saved layout (acceptable — it's just window preferences). No need for project UUIDs.
3. **Grouped layout object, not individual keys.** A single `layout` object in App.svelte is easier to serialize/deserialize, compare, and pass to IPC than 12 separate variables. The refactoring effort is contained to App.svelte and Sidebar.svelte.
4. **Debounced saves.** Resize drags fire dozens of events per second. Debouncing at 1 second prevents excessive disk writes while still capturing the final state.
5. **Screen validation on restore.** Users change monitors. Restoring a window to coordinates that are off-screen is a common Electron bug. Checking against `screen.getAllDisplays()` prevents it.
6. **Theme stays global.** Theme and scale are user preferences, not project preferences. They continue to use localStorage.
