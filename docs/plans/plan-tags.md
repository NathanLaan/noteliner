# Tags

## Overview

Add the ability to assign tags to files. Tags act as virtual groupings — each unique tag appears as an expandable top-level item in the file list, showing all files that carry that tag. A new pane at the bottom of the Sidebar lets users add and remove tags on the selected file.

## Current State

- **Data model:** File entries in `noteliner.json` already have a `tags: []` array (initialized on creation in `project-service.js:137`). No schema migration needed.
- **UI:** `FileTree.svelte` already renders a tag count badge per file (`FileTree.svelte:124-126`). No tag editing UI exists.
- **Store:** `project.svelte.js` has no tag-specific methods.

## Design

### Sidebar layout after implementation

```
┌────────────────────────────┐
│  FILES                     │  <- Existing header
├────────────────────────────┤
│  > Meetings                │  <- Tag group (expandable)
│      File 1                │
│      File 3                │
│  > HR                      │
│      File 2                │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  <- Visual separator
│  File 1                    │  <- Normal file tree (all files)
│  File 2                    │
│    Nested File             │
│  File 3                    │
├────────────────────────────┤
│  TAGS             [+] [-]  │  <- Tags pane header
│  Meeting  HR               │  <- Tags for selected file
└────────────────────────────┘
```

**Tag groups** appear above the normal file tree, separated by a thin divider. Each tag group is collapsible. Clicking a file under a tag group selects it (same as clicking it in the normal tree — it's the same file). Tag groups are sorted alphabetically.

**Tags pane** is a fixed-height section at the bottom of the sidebar. It shows the tags assigned to the currently selected file as small chips/badges. The `+` button adds a tag, the `-` button removes the selected tag.

### Tag editing UX

- **Add tag (+, Ctrl+T):** Shows a small inline text input in the tags pane. The user types a tag name and presses Enter. Autocomplete is not needed for v1 — tags are short strings. If the tag already exists on the file, it is ignored. The input is dismissed on Escape or blur.
- **Remove tag (-, Ctrl+Y):** If a tag chip is selected (clicked) in the pane, removes that tag. If no tag is selected but the file has tags, removes the last tag. If the file has no tags, does nothing.

### Data flow

Tags are just strings stored in `file.tags[]`. No separate tag registry exists — the set of "all tags" is derived by scanning all files. This keeps the data model simple and avoids orphan tag entries.

When tags change:
1. Store method updates the file's `tags` array in memory.
2. `window.api.saveIndex(projectState.index)` persists the change (same flow as drag-and-drop reorder).
3. The index save triggers a git commit + scheduled push (existing behavior).

## Implementation Steps

### Step 1: Store — Tag methods

**File:** `src/renderer/stores/project.svelte.js`

Add methods to `ProjectState`:

```js
get allTags() {
  const tagSet = new Set();
  for (const file of this.index.files) {
    if (file.tags) {
      for (const tag of file.tags) tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

get selectedFileTags() {
  const file = this.selectedFile;
  if (!file) return [];
  return file.tags || [];
}

addTag(fileId, tag) {
  const file = this.index.files.find(f => f.id === fileId);
  if (!file) return;
  if (!file.tags) file.tags = [];
  const normalized = tag.trim();
  if (normalized && !file.tags.includes(normalized)) {
    file.tags.push(normalized);
  }
}

removeTag(fileId, tag) {
  const file = this.index.files.find(f => f.id === fileId);
  if (!file || !file.tags) return;
  file.tags = file.tags.filter(t => t !== tag);
}

getFilesWithTag(tag) {
  return this.index.files
    .filter(f => f.tags && f.tags.includes(tag))
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

No new IPC handlers are needed. Tag changes are persisted via the existing `saveIndex` flow (same as reorder, rename, etc.).

### Step 2: TagGroups component

**New file:** `src/renderer/components/TagGroups.svelte`

Renders the tag groups section above the file tree.

**Props:** `selectedId`, `onSelect`

**Behavior:**

- Derives unique tags from `projectState.allTags`.
- Each tag is a collapsible group header with a tag icon (`fa-tag`) and the tag name.
- Clicking the header toggles expansion (local state, not persisted).
- When expanded, lists files that have that tag (via `projectState.getFilesWithTag(tag)`).
- Each file item is clickable and calls `onSelect(fileId)`.
- Selecting a file highlights it with the same `.selected` style as the normal tree.
- Files under tag groups are not draggable (reorder doesn't apply to virtual groups).

**Layout per tag group:**

```svelte
<div class="tag-group">
  <div class="tag-header" onclick={() => toggle(tag)}>
    <i class="fas fa-chevron-right" class:expanded={isExpanded}></i>
    <i class="fas fa-tag tag-icon"></i>
    <span class="tag-name">{tag}</span>
    <span class="tag-file-count">{count}</span>
  </div>
  {#if isExpanded}
    {#each files as file}
      <div class="tag-file-item" class:selected={file.id === selectedId} onclick={() => onSelect(file.id)}>
        <i class="fas fa-file-lines file-icon"></i>
        <span class="file-name">{file.name}</span>
      </div>
    {/each}
  {/if}
</div>
```

**Styling:**
- Tag headers: 12px left padding, same height as file items, muted icon color.
- Tag file items: 28px left padding (indented under the tag).
- Chevron rotates 90 degrees when expanded (CSS transform transition).
- Separator after all tag groups: a 1px border-bottom with margin.

### Step 3: TagsPane component

**New file:** `src/renderer/components/TagsPane.svelte`

The bottom pane in the sidebar showing tags for the selected file.

**Props:** `onTagsChanged` (callback after add/remove, so Sidebar can persist the index)

**State:**
- `selectedTag` — the tag chip currently selected (clicked) in the pane, or `null`.
- `adding` — boolean, whether the inline add-input is visible.
- `addValue` — the text in the add-input.

**Layout:**

```svelte
<div class="tags-pane">
  <div class="tags-header">
    <span class="tags-title">TAGS</span>
    <div class="tags-actions">
      <button class="tags-btn" onclick={handleAdd} disabled={!hasSelection} title="Add Tag (Ctrl+T)">
        <i class="fas fa-plus"></i>
      </button>
      <button class="tags-btn" onclick={handleRemove} disabled={!hasSelection || noTags} title="Remove Tag (Ctrl+Y)">
        <i class="fas fa-minus"></i>
      </button>
    </div>
  </div>
  <div class="tags-body">
    {#if adding}
      <input class="tag-input" bind:value={addValue} onkeydown={handleInputKeydown} onblur={cancelAdd} use:autoFocus />
    {/if}
    {#each tags as tag}
      <button class="tag-chip" class:selected={tag === selectedTag} onclick={() => selectedTag = (selectedTag === tag ? null : tag)}>
        {tag}
      </button>
    {/each}
    {#if !adding && tags.length === 0 && hasSelection}
      <span class="tags-empty">No tags</span>
    {/if}
  </div>
</div>
```

**Behavior:**

- **Add (+):** Sets `adding = true`, shows input. On Enter: calls `projectState.addTag(fileId, value)`, then `onTagsChanged()`. On Escape/blur: cancels.
- **Remove (-):** If `selectedTag` is set, removes that tag. Otherwise removes the last tag. Calls `projectState.removeTag(fileId, tag)`, then `onTagsChanged()`. Clears `selectedTag`.
- **Tag chips:** Clicking a chip toggles `selectedTag`. Selected chip gets an accent outline (same pattern as active toolbar buttons).
- **No file selected:** Pane shows nothing (buttons disabled).

**Styling:**
- Header matches sidebar-header style: 8px 12px padding, border-top separator, same title font.
- Tag chips: inline-flex, small rounded badges with `var(--bg-button)` background, `var(--text-secondary)` color. Selected: `var(--bg-selected)` + accent outline.
- Tags body: flex wrap layout, gap 4px, padding 8px 12px, max-height ~80px, overflow-y auto.
- Total pane height: ~120px (header + body), flex-shrink 0.

### Step 4: Sidebar integration

**File:** `src/renderer/components/Sidebar.svelte`

Update the sidebar to include TagGroups above the file tree and TagsPane at the bottom.

```svelte
<div class="sidebar-content">
  <div class="sidebar-header">
    <span class="sidebar-title">FILES</span>
  </div>
  <div class="file-list">
    <TagGroups selectedId={projectState.selectedFileId} onSelect={handleSelect} />
    {#if hasTagGroups}
      <div class="tag-separator"></div>
    {/if}
    <FileTree parentId={null} ... />
  </div>
  <TagsPane onTagsChanged={handleTagsChanged} />
</div>
```

Add handler:

```js
async function handleTagsChanged() {
  await window.api.saveIndex(projectState.index);
}
```

Add `hasTagGroups` derived:

```js
let hasTagGroups = $derived(projectState.allTags.length > 0);
```

**Styling for separator:**
```css
.tag-separator {
  height: 1px;
  background: var(--border);
  margin: 6px 12px;
}
```

### Step 5: Keyboard shortcuts

**File:** `src/renderer/App.svelte`

Add in the `handleKeydown` function:

```js
} else if (e.ctrlKey && e.key === 't') {
  e.preventDefault();
  if (projectState.isOpen && projectState.selectedFileId) {
    triggerAddTag();
  }
} else if (e.ctrlKey && e.key === 'y') {
  e.preventDefault();
  if (projectState.isOpen && projectState.selectedFileId) {
    triggerRemoveTag();
  }
}
```

The challenge is that App.svelte needs to tell TagsPane to activate add/remove. Two options:

**Option A — Reactive trigger state:** Add `tagAction` state in App.svelte (`$state(null)`), pass it as a prop through Sidebar to TagsPane. TagsPane watches it via `$effect` and acts when it changes, then clears it. This is the simplest Svelte-idiomatic approach.

**Option B — Custom events:** Dispatch a custom DOM event that TagsPane listens for.

Recommend **Option A** for simplicity. Add to App.svelte:

```js
let tagAction = $state(null);

function triggerAddTag() { tagAction = { type: 'add', ts: Date.now() }; }
function triggerRemoveTag() { tagAction = { type: 'remove', ts: Date.now() }; }
```

Pass `tagAction` through Sidebar to TagsPane. TagsPane has:

```js
$effect(() => {
  if (tagAction) {
    if (tagAction.type === 'add') handleAdd();
    else if (tagAction.type === 'remove') handleRemove();
  }
});
```

### Step 6: Update SettingsModal keyboard shortcuts list

**File:** `src/renderer/components/SettingsModal.svelte`

Add to the `shortcuts` array:

```js
{ keys: 'Ctrl+T', action: 'Add Tag' },
{ keys: 'Ctrl+Y', action: 'Remove Tag' },
```

## File Change Summary

| File | Change |
|---|---|
| `src/renderer/stores/project.svelte.js` | Add `allTags`, `selectedFileTags`, `addTag`, `removeTag`, `getFilesWithTag` |
| `src/renderer/components/TagGroups.svelte` | **New file** — Expandable tag groups above file tree |
| `src/renderer/components/TagsPane.svelte` | **New file** — Bottom pane with tag chips and +/- buttons |
| `src/renderer/components/Sidebar.svelte` | Import TagGroups + TagsPane, add separator, add `handleTagsChanged` |
| `src/renderer/App.svelte` | Add `tagAction` state, `Ctrl+T` / `Ctrl+Y` shortcuts, pass through Sidebar |
| `src/renderer/components/SettingsModal.svelte` | Add Ctrl+T and Ctrl+Y to shortcuts list |

## Design Decisions

1. **No separate tag registry.** Tags are derived from file entries. This avoids orphan tags and keeps the data model flat. When the last file removes a tag, that tag disappears from the tag groups automatically.
2. **Tag groups above the file tree, not replacing it.** Every file still appears in the normal tree regardless of tags. Tag groups are a supplementary view — like virtual folders. This avoids confusion about where a file "lives".
3. **Tags pane at the bottom, not inline.** Inline tag editing on each file item would clutter the tree. A dedicated pane keeps the tree clean and provides space for the add input and chip selection.
4. **Persist via saveIndex, no new IPC.** Tag changes modify the in-memory index, then save it through the existing `saveIndex` flow. This is consistent with how drag-and-drop reorder works and avoids adding backend complexity.
5. **Option A (reactive trigger) for keyboard shortcuts.** Svelte 5 reactive state is the natural way to communicate between App and a deeply nested component. Custom DOM events would work but add ceremony.
6. **No autocomplete in v1.** Tag names are typically short. Autocomplete from existing tags can be added later without structural changes.
