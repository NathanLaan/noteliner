# File History Panel

## Overview

Add a History panel that shows the git commit history for the currently selected file. The panel appears as a new column in the content area (like Preview), toggled from a button in the editor toolbar. The panel is split into two resizable panes: a commit list at the top and a markdown preview of the selected commit's content at the bottom.

## Current State

- **Editor toolbar** (`Editor.svelte:287-304`) — Shows file name and a Preview toggle button. The `editor-actions` div holds action buttons.
- **Preview panel** (`Preview.svelte`) — A column next to the editor with a header ("PREVIEW", close button) and rendered markdown. Appears conditionally via `layout.showPreview` in `App.svelte`.
- **Git service** (`git-service.js`) — Has `exec(args, cwd)` for arbitrary git commands. No file-history methods exist.
- **Layout persistence** — Panel visibility is saved per-project in `layout.*` via `WindowStateService`.

## Design

### Panel layout

```
┌──────────────────────────────────────────────────┐
│ Editor Toolbar    [name]     [🕐] [👁]           │
├────────────┬─────────────┬───────────────────────┤
│            │             │ HISTORY            [x] │
│            │             ├───────────────────────┤
│  Sidebar   │   Editor    │ 2026-04-15 Edit foo   │
│            │             │ 2026-04-14 Add bar     │
│            │             │ 2026-04-13 Initial     │
│            │             ├───────────────────────┤
│            │             │ (Preview of selected   │
│            │             │  commit's content)     │
└────────────┴─────────────┴───────────────────────┘
```

The History panel appears to the right of the editor (before Preview/Attachments if they're also open). It has:
- A header with "HISTORY" title and a close (x) button (same pattern as Preview)
- A top pane: scrollable list of commits
- A horizontal resizer between the panes
- A bottom pane: markdown preview of the selected commit's file content

### Commit list

Each entry shows:
- Date (formatted as `YYYY-MM-DD HH:mm`)
- Commit message (first line)
- Author name

Clicking an entry loads that version's content into the bottom preview pane. The currently selected entry is highlighted.

### History preview pane

Renders the file's content at the selected commit using `marked()` — same rendering as the main Preview panel, including attachment URL resolution. Shows "Select a commit to preview" when no commit is selected.

## Implementation Steps

### Step 1: Git service — File history methods

**File:** `src/main/git-service.js`

Add two methods:

```js
async getFileLog(folderPath, filename) {
  // Returns commit log for a specific file
  const raw = await this.exec([
    'log', '--follow',
    '--pretty=format:%H|%ai|%an|%s',
    '--', filename
  ], folderPath);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const [hash, date, author, ...msgParts] = line.split('|');
    return { hash, date, author, message: msgParts.join('|') };
  });
}

async getFileAtCommit(folderPath, commit, filename) {
  try {
    return await this.exec(['show', `${commit}:${filename}`], folderPath);
  } catch {
    return null;
  }
}
```

`--follow` tracks file renames. The `%H|%ai|%an|%s` format gives full hash, author date (ISO-ish), author name, and subject line.

### Step 2: IPC handlers and preload

**File:** `src/main/main.js`

```js
ipcMain.handle('file:getHistory', async (_event, filename) => {
  if (!projectService.projectPath) return [];
  return await gitService.getFileLog(projectService.projectPath, filename);
});

ipcMain.handle('file:getHistoryContent', async (_event, commit, filename) => {
  if (!projectService.projectPath) return null;
  return await gitService.getFileAtCommit(projectService.projectPath, commit, filename);
});
```

**File:** `src/main/preload.js`

```js
getFileHistory: (filename) => ipcRenderer.invoke('file:getHistory', filename),
getFileHistoryContent: (commit, filename) => ipcRenderer.invoke('file:getHistoryContent', commit, filename),
```

### Step 3: HistoryPanel component

**New file:** `src/renderer/components/HistoryPanel.svelte`

**Props:** `onClose`

**State:**
- `commits` — array of `{ hash, date, author, message }` loaded on mount and on file selection change
- `selectedCommit` — hash of the currently selected commit
- `historicalContent` — markdown content at the selected commit
- `commitListHeight` — height of the top pane (resizable, default 50%)
- `loading` — boolean for loading state

**Behavior:**
- On mount and when `projectState.selectedFile` changes, fetch the commit log via `window.api.getFileHistory(filename)`.
- When a commit is clicked, fetch the content via `window.api.getFileHistoryContent(hash, filename)` and render it.
- The preview uses `marked()` and the same `resolveAttachmentUrls()` as Preview.svelte.

**Layout:**
```svelte
<div class="history-wrapper">
  <div class="history-toolbar">
    <span class="history-title">HISTORY</span>
    <button class="close-btn" onclick={onClose}><i class="fas fa-xmark"></i></button>
  </div>
  <div class="commit-list" style="height: {commitListHeight}px">
    {#each commits as commit}
      <div class="commit-item" class:selected={commit.hash === selectedCommit} onclick={() => selectCommit(commit)}>
        <span class="commit-date">{formatDate(commit.date)}</span>
        <span class="commit-message">{commit.message}</span>
        <span class="commit-author">{commit.author}</span>
      </div>
    {/each}
  </div>
  <div class="pane-resizer" onmousedown={startResize}></div>
  <div class="history-preview">
    {@html previewHtml}
  </div>
</div>
```

**Styling:** Follow Preview.svelte's patterns — same toolbar height (44px), same markdown content styles (reuse via global CSS or duplicate). The commit list items use the file-tree item style (hover, selected states).

### Step 4: Editor toolbar — History button

**File:** `src/renderer/components/Editor.svelte`

Add a new prop `showHistory` and callback `onToggleHistory`. Add a button to the left of the Preview button:

```svelte
<div class="editor-actions">
  <button
    class="editor-btn"
    class:active={showHistory}
    onclick={onToggleHistory}
    title="Toggle History (Ctrl+H)"
  >
    <i class="fas fa-clock-rotate-left"></i>
  </button>
  <button
    class="editor-btn"
    class:active={showPreview}
    onclick={onTogglePreview}
    title="Toggle Preview (Ctrl+P)"
  >
    <i class="fas fa-eye"></i>
  </button>
</div>
```

`fa-clock-rotate-left` is the standard history/revision icon.

### Step 5: App.svelte integration

**File:** `src/renderer/App.svelte`

1. Add `showHistory: false` to `DEFAULT_LAYOUT`.
2. Add toggle handler:
   ```js
   function handleToggleHistory() {
     layout.showHistory = !layout.showHistory;
   }
   ```
3. Add `Ctrl+H` keyboard shortcut.
4. Pass `showHistory` and `onToggleHistory` to Editor.
5. Render HistoryPanel conditionally between the editor and Preview:
   ```svelte
   {#if layout.showHistory}
     <div class="resizer history-resizer"></div>
     <div class="history-area">
       <HistoryPanel onClose={handleToggleHistory} />
     </div>
   {/if}
   ```
6. Add `.history-area` CSS: `flex: 1; overflow: hidden; max-width: 50%; border-left: 1px solid var(--border);`

### Step 6: Add shortcut to SettingsModal

**File:** `src/renderer/components/SettingsModal.svelte`

Add to the `shortcuts` array:

```js
{ keys: 'Ctrl+H', action: 'Toggle History' },
```

## File Change Summary

| File | Change |
|---|---|
| `src/main/git-service.js` | Add `getFileLog`, `getFileAtCommit` methods |
| `src/main/main.js` | Add `file:getHistory`, `file:getHistoryContent` IPC handlers |
| `src/main/preload.js` | Add `getFileHistory`, `getFileHistoryContent` API methods |
| `src/renderer/components/HistoryPanel.svelte` | **New file** — Commit list + historical preview with resizable split |
| `src/renderer/components/Editor.svelte` | Add history toggle button, `showHistory`/`onToggleHistory` props |
| `src/renderer/App.svelte` | Add `showHistory` to layout, handler, `Ctrl+H` shortcut, render HistoryPanel |
| `src/renderer/components/SettingsModal.svelte` | Add `Ctrl+H` to shortcuts list |

## Design Decisions

1. **Panel positioned between Editor and Preview.** History is about the editor's file, so it makes sense right next to the editor. If Preview is also open, the user sees: Editor | History | Preview — three views of the same file (current text, past versions, rendered output).

2. **Split pane inside the History panel.** The commit list and historical preview are in one column, vertically split with a resizer. This keeps the panel self-contained — no new top-level layout complexity in App.svelte.

3. **`git log --follow`** for rename tracking. If a file was renamed, the history still shows commits from before the rename.

4. **`git show <commit>:<filename>`** for content retrieval. Lightweight — doesn't require checking out the commit. Returns the file content as a string.

5. **`fa-clock-rotate-left`** icon. The standard "history" icon in FontAwesome. Clearly communicates "version history" or "past revisions."

6. **No layout persistence for the internal split.** The commit-list vs. preview split ratio inside the History panel is local state (not saved per-project). It's a transient UI detail — simpler than adding another height to the layout object.

7. **Ctrl+H shortcut.** Widely used for history in browsers and IDEs. Doesn't conflict with existing shortcuts in the app.
