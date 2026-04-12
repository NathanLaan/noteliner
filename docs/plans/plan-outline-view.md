# Outline View

## Overview

Add a document outline panel that displays the heading structure (#, ##, ###, ####) of the currently selected file. The outline appears in the FILES panel (Sidebar), between the file list and the TAGS pane. Clicking a heading in the outline scrolls the editor to that line. A toolbar toggle button controls visibility.

## Current State

- **Editor:** `Editor.svelte` uses CodeMirror 6. The `editorView` instance is local — not exposed to other components. The editor content is mirrored in `projectState.editorContent`.
- **Sidebar:** Contains FILES header, TagGroups, FileTree, and TagsPane. The `file-list` div has `flex: 1; overflow-y: auto`.
- **Toolbar:** Has toggle buttons for Files Panel, Attachments, and Log, all with active-highlight styling.

## Design

### Sidebar layout after implementation

```
┌────────────────────────────┐
│  FILES                     │  <- Existing header
├────────────────────────────┤
│  > Meetings                │  <- Tag groups
│  File 1                    │  <- File tree
│  File 2                    │
├────────────────────────────┤
│  OUTLINE                   │  <- New outline pane (when visible)
│    # Introduction           │
│      ## Background          │
│      ## Motivation          │
│    # Implementation         │
│      ## Architecture        │
│        ### Data Model       │
├────────────────────────────┤
│  TAGS             [+] [-]  │  <- Existing tags pane
│  Meeting  HR               │
└────────────────────────────┘
```

The outline pane sits between the file list and the TAGS pane. It has its own header ("OUTLINE") and a scrollable list of headings with depth-based indentation.

### Heading extraction

Parse headings from `projectState.editorContent` using a simple regex. No markdown AST needed — just match lines starting with `#` through `####`:

```js
function extractHeadings(content) {
  if (!content) return [];
  const headings = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,    // 1-4
        text: match[2].trim(),
        line: i + 1                // 1-based line number
      });
    }
  }
  return headings;
}
```

This runs in the renderer — no backend changes needed. It derives from `projectState.editorContent`, which updates on every keystroke (debounced save, but the content state is immediate).

### Editor scroll-to-line

The outline needs to scroll the CodeMirror editor to a specific line when clicked. Since `editorView` is local to `Editor.svelte`, the cleanest approach is to expose a `scrollToLine` function from the Editor via a callback or by putting a scroll request in the project store.

**Approach:** Add a `scrollToLine` field to `projectState`:

```js
scrollToLine = $state(null);  // { line: number, ts: number } or null
```

- The outline sets `projectState.scrollToLine = { line: 42, ts: Date.now() }`.
- Editor.svelte watches this via `$effect` and calls `editorView.dispatch({ effects: EditorView.scrollIntoView(pos) })`.
- The `ts` field ensures each click is a unique trigger (even for the same line).

This avoids coupling Editor and OutlinePane directly.

### CodeMirror scroll implementation

In Editor.svelte, convert a 1-based line number to a document position and scroll:

```js
$effect(() => {
  const req = projectState.scrollToLine;
  if (req && editorView) {
    const line = editorView.state.doc.line(Math.min(req.line, editorView.state.doc.lines));
    editorView.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start' })
    });
    editorView.focus();
  }
});
```

## Implementation Steps

### Step 1: Store — Add scrollToLine

**File:** `src/renderer/stores/project.svelte.js`

Add to `ProjectState`:

```js
scrollToLine = $state(null);
```

Clear it in `load()` and `close()`.

### Step 2: OutlinePane component

**New file:** `src/renderer/components/OutlinePane.svelte`

**Props:** `visible` (boolean — controls whether the pane renders)

**Behavior:**
- Derives headings from `projectState.editorContent` using `extractHeadings()`.
- Renders a header ("OUTLINE") and a scrollable list of heading items.
- Each item is indented based on level: `padding-left: {8 + (level - 1) * 14}px`.
- Clicking an item sets `projectState.scrollToLine = { line, ts: Date.now() }`.
- When no file is selected or the file has no headings, shows "No headings" in muted italic.

**Layout:**

```svelte
<div class="outline-pane">
  <div class="outline-header">
    <span class="outline-title">OUTLINE</span>
  </div>
  <div class="outline-list">
    {#each headings as h (h.line)}
      <div class="outline-item" style="padding-left: {8 + (h.level - 1) * 14}px" onclick={() => handleClick(h.line)}>
        {h.text}
      </div>
    {/each}
  </div>
</div>
```

**Styling:**
- Header matches sidebar-header and tags-header style (border-top, same title font).
- Outline list: `overflow-y: auto`, `flex: 1` within the pane, items have hover and text styles matching file tree items.
- Item font size: 12px. Level 1 items slightly bolder than deeper levels.
- Pane has `flex: 1` with a `min-height` and `max-height` so it shares space with the file list.

### Step 3: Editor — Watch scrollToLine

**File:** `src/renderer/components/Editor.svelte`

Add a `$effect` that watches `projectState.scrollToLine`:

```js
$effect(() => {
  const req = projectState.scrollToLine;
  if (req && editorView) {
    const lineCount = editorView.state.doc.lines;
    const lineNum = Math.min(req.line, lineCount);
    const line = editorView.state.doc.line(lineNum);
    editorView.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'start' })
    });
    editorView.focus();
  }
});
```

Import `EditorView` is already available (used in `createEditor`). The `scrollIntoView` effect is built into CodeMirror 6.

### Step 4: Sidebar integration

**File:** `src/renderer/components/Sidebar.svelte`

Add a new prop: `outlineVisible`.

Import and render `OutlinePane` between the file list and TagsPane:

```svelte
  <div class="file-list">
    <TagGroups ... />
    {#if hasTagGroups}<div class="tag-separator"></div>{/if}
    <FileTree ... />
  </div>
  {#if outlineVisible}
    <OutlinePane />
  {/if}
  <TagsPane ... />
```

### Step 5: Toolbar button

**File:** `src/renderer/components/Toolbar.svelte`

Add `onToggleOutline` and `outlineVisible` to props.

Add a toggle button after the Files Panel button:

```svelte
<button class="toolbar-btn" class:active={outlineVisible} onclick={onToggleOutline} title="Toggle Outline (Ctrl+Shift+O)">
  <i class="fas fa-list-ol"></i>
</button>
```

The `fa-list-ol` icon (ordered list) communicates "document outline / table of contents." Alternative: `fa-list-tree` if available.

### Step 6: App integration

**File:** `src/renderer/App.svelte`

1. Add state: `let showOutline = $state(false);`
2. Add handler: `function handleToggleOutline() { showOutline = !showOutline; }`
3. Add keyboard shortcut `Ctrl+Shift+O` in `handleKeydown`:
   ```js
   } else if (e.ctrlKey && e.shiftKey && e.code === 'KeyO') {
     e.preventDefault();
     if (projectState.isOpen) handleToggleOutline();
   }
   ```
4. Pass `onToggleOutline={handleToggleOutline}` and `outlineVisible={showOutline}` to Toolbar.
5. Pass `outlineVisible={showOutline}` to Sidebar.

### Step 7: Update SettingsModal shortcuts list

**File:** `src/renderer/components/SettingsModal.svelte`

Add to the `shortcuts` array:

```js
{ keys: 'Ctrl+Shift+O', action: 'Toggle Outline' },
```

## File Change Summary

| File | Change |
|---|---|
| `src/renderer/stores/project.svelte.js` | Add `scrollToLine` state field |
| `src/renderer/components/OutlinePane.svelte` | **New file** — Outline heading list with click-to-scroll |
| `src/renderer/components/Editor.svelte` | Add `$effect` watching `scrollToLine`, dispatch scroll |
| `src/renderer/components/Sidebar.svelte` | Import OutlinePane, add `outlineVisible` prop, render conditionally |
| `src/renderer/components/Toolbar.svelte` | Add outline toggle button with `fa-list-ol` icon |
| `src/renderer/App.svelte` | Add `showOutline` state, handler, `Ctrl+Shift+O` shortcut, pass props |
| `src/renderer/components/SettingsModal.svelte` | Add Ctrl+Shift+O to shortcuts list |

## Design Decisions

1. **Heading extraction via regex, not markdown AST.** A simple regex (`/^(#{1,4})\s+(.+)/`) is fast, doesn't require a new dependency, and covers standard markdown headings. Code fences could produce false positives (a `#` line inside a code block), but this is rare in note-taking content and can be refined later.
2. **scrollToLine in the store, not direct coupling.** The outline and editor don't share a component hierarchy (outline is in Sidebar, editor is a sibling). A store field is the simplest Svelte-idiomatic decoupling. The `ts` timestamp ensures repeated clicks on the same heading still trigger a scroll.
3. **Outline in the Sidebar, not a separate panel.** Placing it between the file list and TAGS pane keeps all navigation in one column. The file list and outline share the vertical space — when the outline is open, the file list shrinks.
4. **Ctrl+Shift+O shortcut.** Matches VS Code's "Go to Symbol in Editor" which opens an outline-like view. The Shift modifier avoids conflict with Ctrl+O (Open Folder).
5. **Hidden by default.** The outline is optional — most short notes don't need it. Users toggle it on for longer structured documents.
