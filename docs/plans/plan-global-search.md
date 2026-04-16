# Global Search — Implementation Plan

## Overview

Add a cross-document text search that lets the user search for text within any
file in the project. Results display inline in a sidebar panel with file name,
line number, and context snippet. Clicking a result navigates to that file and
scrolls to the matching line.

---

## UI Design

### Panel Placement

Search lives in a **new sidebar pane** integrated into the existing pane system
(`Sidebar.svelte`). This is consistent with how FILES, TAGS, OUTLINE, and TAG
GROUPS already work — it gets its own collapsible pane with a header, is
reorderable via drag-and-drop, and resizes with the existing dividers.

The pane contains a search input at the top and a scrollable results list below.

```
Toolbar | Sidebar                           | Editor
        | [FILES       ]                    |
        | [TAGS        ]                    |
        | [SEARCH      ]  <-- new pane      |
        |   [____search input____]          |
        |   file-a.md:12  matching line...  |
        |   file-b.md:7   matching line...  |
```

### Toolbar Button

Add a search toggle button in the toolbar (after Attachments, before Sync):

```
fa-magnifying-glass icon, title="Search (Ctrl+F)"
```

Active state (accent outline) when `layout.showSearch` is true.

### Keyboard Shortcuts

**Ctrl+F** — toggle the global search pane. When toggling on, auto-focus the
search input. Ctrl+F is intercepted at the App level before CodeMirror sees it.

**Ctrl+Shift+F** — open CodeMirror's built-in in-file search and replace. This
is wired by adding the CodeMirror `search` extension to the editor, which
provides the standard find/replace bar (with regex, case-sensitive, whole-word
options). Ctrl+Shift+F is handled by CodeMirror directly — the App-level
keydown handler must NOT `preventDefault()` for this combo, so it propagates
to the editor.

This gives a clean split: **Ctrl+F = cross-file, Ctrl+Shift+F = in-file**.

---

## Search Backend

### Approach: Main-Process Search via IPC

The search runs in the **main process** (Node.js), not the renderer. Reasons:

1. The main process has direct `fs` access — no per-file IPC round-trip.
2. For a note-taking app (typically <1000 small markdown files), synchronous
   `fs.readFileSync` across all files completes in <50ms.
3. A single IPC call (`search:query` -> results) keeps the renderer simple.

### `ProjectService.search(query, options)` Method

Add to `project-service.js`:

```javascript
search(query, options = {}) {
  if (!this.projectPath || !query) return [];
  const caseSensitive = options.caseSensitive || false;
  const searchStr = caseSensitive ? query : query.toLowerCase();
  const results = [];

  for (const file of this.index.files) {
    const filePath = path.join(this.projectPath, file.filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const compareLine = caseSensitive ? line : line.toLowerCase();
      if (compareLine.includes(searchStr)) {
        matches.push({
          line: i + 1,       // 1-based line number
          text: line.trim(),  // matched line content (trimmed)
        });
      }
    }

    if (matches.length > 0) {
      results.push({
        fileId: file.id,
        fileName: file.name,
        filename: file.filename,
        matches,
      });
    }
  }
  return results;
}
```

### IPC Wiring

**preload.js** — add to the `contextBridge.exposeInMainWorld` block:

```javascript
searchFiles: (query, options) => ipcRenderer.invoke('search:query', query, options),
```

**main.js** — add IPC handler:

```javascript
ipcMain.handle('search:query', async (_event, query, options) => {
  if (!projectService.projectPath) return [];
  return projectService.search(query, options);
});
```

---

## UI Components

### SearchPane.svelte (New Component)

A new component rendered inside Sidebar.svelte, following the same pattern as
TagsPane, OutlinePane, etc.

**Structure:**

```svelte
<div class="search-pane">
  <div class="search-input-container">
    <input type="text" placeholder="Search..." bind:value={query} />
  </div>

  {#if searching}
    <div class="search-status">Searching...</div>
  {:else if query && results.length === 0}
    <div class="search-empty">No results</div>
  {:else}
    <div class="search-results">
      {#each results as group}
        <div class="result-group">
          <div class="result-file">{group.fileName}</div>
          {#each group.matches as match}
            <button class="result-line" onclick={() => navigateTo(group.fileId, match.line)}>
              <span class="line-num">{match.line}</span>
              <span class="line-text">{highlightMatch(match.text, query)}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>
```

**Behavior:**

- Input is debounced (300ms) before triggering a search.
- Results grouped by file, each group showing the file name as a header.
- Each match row shows line number + line text with the query highlighted.
- Clicking a result calls `projectState.selectFile(fileId)` then sets
  `projectState.scrollToLine = { line, ts: Date.now() }` to scroll the editor.
- The existing `scrollToLine` mechanism in Editor.svelte (line 253) already
  handles this.

**Match highlighting:** The matched substring within each line is wrapped in a
`<mark>` element (or a `<span class="search-highlight">`) for visual emphasis.

### Integration into Sidebar.svelte

Add to `PANE_META`:

```javascript
search: { title: 'SEARCH', heightKey: 'searchHeight', minH: HEADER_H },
```

Add to `isPaneVisible`:

```javascript
if (key === 'search') return searchVisible;
```

Add `searchVisible` and `searchHeight` as props. The search pane renders
`SearchPane` in its body, same pattern as the other panes.

Add a prop `searchFocusRequest` (timestamp) so the App can signal "focus the
search input" when Ctrl+F is pressed.

---

## Editor.svelte — In-File Search (Ctrl+Shift+F)

`basicSetup` from `codemirror` already includes `@codemirror/search` with its
`searchKeymap`, which binds `Mod-f` to `openSearchPanel`. Since Ctrl+F will be
intercepted at the App level for global search, the built-in binding never
fires.

To remap in-file search to Ctrl+Shift+F, add a custom keymap to the editor
extensions:

```javascript
import { openSearchPanel } from '@codemirror/search';

// In the extensions array of EditorState.create():
keymap.of([
  indentWithTab,
  { key: 'Mod-Shift-f', run: openSearchPanel },
]),
```

This opens CodeMirror's built-in search/replace panel inside the editor. It
already supports case-sensitive, regex, and replace-all — no custom UI needed.

The App.svelte `handleKeydown` must NOT call `preventDefault()` for
Ctrl+Shift+F, so the event propagates down to CodeMirror.

---

## App.svelte Integration

### Layout State

Add to `DEFAULT_LAYOUT`:

```javascript
showSearch: false,
searchHeight: 200,
```

Add `'search'` to the default `paneOrder` array.

### Toggle Handler

```javascript
function handleToggleSearch() {
  layout.showSearch = !layout.showSearch;
  if (layout.showSearch) {
    searchFocusTs = Date.now();  // triggers input focus
  }
}
```

### Keyboard Shortcut

Add to the `handleKeydown` function:

```javascript
} else if (e.ctrlKey && e.key === 'f') {
  e.preventDefault();
  handleToggleSearch();
}
```

### Toolbar Wiring

Pass `onToggleSearch={handleToggleSearch}` and
`searchVisible={layout.showSearch}` to the Toolbar component.

### Sidebar Props

Pass `searchVisible={layout.showSearch}`, `searchHeight={layout.searchHeight}`,
and `searchFocusRequest={searchFocusTs}` to the Sidebar component.

---

## Toolbar.svelte Changes

Add a new prop `onToggleSearch` and `searchVisible`. Add button:

```svelte
<button class="toolbar-btn" class:active={searchVisible}
  onclick={onToggleSearch} title="Search (Ctrl+F)">
  <i class="fas fa-magnifying-glass"></i>
</button>
```

Place it after the Attachments button and before the Sync button.

---

## SettingsModal.svelte Changes

Add to the shortcuts list:

```javascript
{ keys: 'Ctrl+F', action: 'Global Search' },
{ keys: 'Ctrl+Shift+F', action: 'Find in File' },
```

---

## Implementation Steps

### Step 1 — Backend search method + IPC

Files: `project-service.js`, `main.js`, `preload.js`

- Add `search(query, options)` to ProjectService.
- Add `search:query` IPC handler in main.js.
- Expose `searchFiles` in preload.js.
- Test via DevTools console: `await window.api.searchFiles('test')`.

### Step 2 — SearchPane.svelte component

Files: new `SearchPane.svelte`

- Create the component with search input, debounced query, results list.
- Wire up `window.api.searchFiles()` calls.
- Handle result click -> `projectState.selectFile()` + `scrollToLine`.
- Style using existing theme CSS variables.

### Step 3 — Sidebar integration

Files: `Sidebar.svelte`

- Add `search` to `PANE_META` and `isPaneVisible`.
- Add `searchVisible`, `searchHeight`, `searchFocusRequest` props.
- Render `SearchPane` in the pane body.
- Add `getHeightForPane` case for `search`.

### Step 4 — App + Toolbar wiring

Files: `App.svelte`, `Toolbar.svelte`, `SettingsModal.svelte`

- Add `showSearch` and `searchHeight` to `DEFAULT_LAYOUT`.
- Add `'search'` to `paneOrder`.
- Add `handleToggleSearch` function and Ctrl+F shortcut.
- Pass new props to Sidebar and Toolbar.
- Add Toolbar button.
- Add shortcuts to SettingsModal list.

### Step 5 — In-file search keybinding

Files: `Editor.svelte`

- Import `openSearchPanel` from `@codemirror/search`.
- Add `{ key: 'Mod-Shift-f', run: openSearchPanel }` to the editor keymap.
- Verify Ctrl+Shift+F opens the CodeMirror find/replace bar.

### Step 6 — Polish

- Test with empty project (no files), single file, many files.
- Verify search updates when files are created/deleted/renamed.
- Verify pane resizing, reordering, and persistence work with the new pane.
- Verify Ctrl+F opens global search and auto-focuses the input.
- Verify Ctrl+Shift+F opens in-file find/replace in the editor.

---

## Design Decisions & Rationale

| Decision | Rationale |
|----------|-----------|
| Main-process search | Direct fs access, single IPC round-trip, simple renderer code |
| Sidebar pane (not separate panel) | Consistent with existing UI; gets free resizing, reordering, persistence |
| Ctrl+F = global, Ctrl+Shift+F = in-file | Global search is the more common action in a multi-doc app; Ctrl+Shift+F mirrors VS Code's convention for project-wide vs file-level search (reversed, but adapted to this app's priorities) |
| Debounced input (300ms) | Prevents hammering the main process while typing |
| Line-level granularity | Matches how the editor and outline already work (scrollToLine) |
| Case-insensitive by default | Most useful for note searching; case-sensitive can be a future toggle |
| No in-memory search index | For typical project sizes (<1000 files), scanning all files on each query is fast enough; avoids complexity of cache invalidation |
