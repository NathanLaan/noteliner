# Sidebar Pane Reordering

## Overview

Allow the user to drag pane headers (FILES, TAG GROUPS, OUTLINE, TAGS) to reorder the panes within the Sidebar. Persist the order per project. Also unify all pane header heights to match the FileTree's "FILES" header for visual consistency.

## Current State

**Sidebar layout (`Sidebar.svelte`):** A fixed top-down structure:

1. **FILES header** (44px min-height, padding 8px 12px) — wraps the FileTree which has `flex: 1`
2. **TAG GROUPS pane** (conditional, resizable height) — has its own header (6px padding, smaller)
3. **OUTLINE pane** (conditional, resizable height) — has its own header (6px padding)
4. **TAGS pane** (always shown, resizable height) — has its own header (6px padding)

**Pane header heights:**
- `Sidebar.svelte` `.sidebar-header` for FILES: `padding: 8px 12px; min-height: 44px;`
- `TagGroupsPane.svelte` `.tag-groups-header`: `padding: 6px 12px;` (no min-height)
- `OutlinePane.svelte` `.outline-header`: `padding: 6px 12px;`
- `TagsPane.svelte` `.tags-header`: `padding: 6px 12px;` (also has the +/- buttons)

**Layout mechanics:** The bottom three panes have fixed pixel heights (controlled by App.svelte's layout state). The FileTree fills remaining space (`flex: 1`). Resizers between panes drag the pane immediately below them.

**Persistence:** Pane heights and visibility are already persisted per project via `WindowStateService` (`window-state.json` keyed by folder path).

## Design

### Unified header height

All four pane headers will use the same height (44px) and same internal layout:
- Header height: `44px` (matches current FILES header)
- Padding: `8px 12px`
- Title font: 11px, 600 weight, letter-spacing 0.5px, muted color
- Background: `var(--bg-base)`
- Border-bottom: `1px solid var(--border)` (currently only TagGroupsPane has this)

The TagsPane header will keep its right-aligned `+`/`-` buttons; the others get just the title.

### Pane order

The Sidebar renders an array of pane definitions in order. The array is driven by `layout.paneOrder`, persisted per project. Default order:

```js
paneOrder: ['files', 'tagGroups', 'outline', 'tags']
```

Each pane has:
- A unique key (`'files'`, `'tagGroups'`, `'outline'`, `'tags'`)
- A visibility flag (FILES is always visible, others depend on `layout.show*`)
- A height (FILES is `flex: 1`; others use saved heights)

The Sidebar iterates `paneOrder` and renders each pane that's visible. Resizers are inserted **between** panes — only between two visible flexible panes. The `flex: 1` pane (currently FILES, but could be any pane after reordering) absorbs leftover space.

**Critical design decision:** Only ONE pane can be `flex: 1` at a time. The first visible pane in the order becomes the flex pane, the rest use fixed heights. This avoids a layout where resizers don't make sense (e.g., two flex panes both trying to absorb leftover space).

Alternative: every pane uses a fixed height except the LAST one. This is simpler and more predictable — the bottom pane always absorbs leftover space. Recommend this approach.

### Drag-to-reorder

The header of each pane becomes a drag handle. When dragged onto another pane's header, the dragged pane is repositioned in the order array.

**Visual feedback during drag:**
- The dragged header gets reduced opacity
- The hovered target header shows a top or bottom border accent indicating insertion point (above or below based on cursor Y position relative to header center)

**Drag detection:**
- `dragstart` on header sets `dataTransfer` with the pane key (e.g. `'tagGroups'`)
- Use a custom MIME type like `application/x-noteliner-pane` to avoid conflicts with the existing FileTree drags (which use `text/plain`)
- `dragover` on a header determines insertion position (before/after)
- `drop` reorders the array and saves

### Persistence

`paneOrder` is a new field in the `layout` object in `App.svelte`. It piggybacks on the existing per-project layout persistence:

- Saved on every change (debounced via the existing `$effect`)
- Restored when project loads
- Default: `['files', 'tagGroups', 'outline', 'tags']`

## Implementation Steps

### Step 1: Add paneOrder to layout state

**File:** `src/renderer/App.svelte`

Add to `DEFAULT_LAYOUT`:

```js
paneOrder: ['files', 'tagGroups', 'outline', 'tags'],
```

The existing debounced save effect already handles persistence — no changes needed there.

### Step 2: Unify pane header styling

Create a shared header style. The cleanest approach is to add it to `global.css` so all panes can use it via class names:

**File:** `src/renderer/styles/global.css`

```css
.pane-header {
  padding: 8px 12px;
  min-height: 44px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-base);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pane-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
```

**Files:** `TagGroupsPane.svelte`, `OutlinePane.svelte`, `TagsPane.svelte`

Replace each pane's local header classes with `.pane-header` and `.pane-title`. Remove the duplicate scoped styles.

The Sidebar's "FILES" header (currently inline in Sidebar.svelte) needs to move into a wrapper component or be inlined per-pane in the new layout. See Step 3.

### Step 3: Refactor Sidebar to render panes from order array

**File:** `src/renderer/components/Sidebar.svelte`

Replace the hardcoded pane sequence with a loop driven by `paneOrder`:

```svelte
<script>
  let { paneOrder = ['files', 'tagGroups', 'outline', 'tags'], onPaneReorder, ... } = $props();

  const PANE_DEFINITIONS = {
    files: { title: 'FILES', component: 'files-content' },
    tagGroups: { title: 'TAG GROUPS', component: 'tag-groups-content' },
    outline: { title: 'OUTLINE', component: 'outline-content' },
    tags: { title: 'TAGS', component: 'tags-content' },
  };

  // Filter paneOrder by visibility
  let visiblePanes = $derived(paneOrder.filter(key => isPaneVisible(key)));

  function isPaneVisible(key) {
    if (key === 'files') return true;
    if (key === 'tagGroups') return tagGroupsVisible;
    if (key === 'outline') return outlineVisible;
    if (key === 'tags') return true; // always visible
  }
</script>

<div class="sidebar-content" ...>
  {#each visiblePanes as paneKey, i (paneKey)}
    {#if i > 0}
      <div class="pane-resizer" onmousedown={startResize(paneKey, ...)}></div>
    {/if}
    <div class="resizable-pane" style={getPaneStyle(paneKey, i, visiblePanes.length)}>
      <div class="pane-header" draggable="true"
           ondragstart={(e) => handleHeaderDragStart(e, paneKey)}
           ondragover={(e) => handleHeaderDragOver(e, paneKey)}
           ondrop={(e) => handleHeaderDrop(e, paneKey)}>
        <span class="pane-title">{PANE_DEFINITIONS[paneKey].title}</span>
        {#if paneKey === 'tags'}
          {/* tags +/- buttons stay here */}
        {/if}
      </div>
      <div class="pane-body">
        {#if paneKey === 'files'}
          <FileTree ... />
        {:else if paneKey === 'tagGroups'}
          <TagGroupsPane ... />
        {:else if paneKey === 'outline'}
          <OutlinePane />
        {:else if paneKey === 'tags'}
          <TagsPane ... />
        {/if}
      </div>
    </div>
  {/each}
</div>
```

`getPaneStyle(key, index, total)`:
- Last pane: `flex: 1; min-height: 100px;`
- Other panes: `height: {savedHeight}px; flex-shrink: 0;`

### Step 4: Strip header markup from inner pane components

**Files:** `TagGroupsPane.svelte`, `OutlinePane.svelte`, `TagsPane.svelte`

Since the Sidebar now owns the header, each pane component becomes header-less. Each component returns just the body (`.tag-groups-list`, `.outline-list`, `.tags-body`).

Special case for **TagsPane**: it has the +/- toolbar buttons in its header. These need to either:
- Stay in the TagsPane component but render as a "header actions" slot that the Sidebar embeds in the shared header. **Simplest approach.**
- OR move into the TagsPane body area.

Recommend: Add an `{#snippet headerActions()}` parameter to TagsPane that the Sidebar renders inside the shared header for the tags pane. (Alternative: use a Svelte action / portal — too complex for this case.)

Actually, the cleanest approach without snippets: add a small "headerActions" component prop.

**Even simpler:** Keep the +/- buttons in TagsPane, but move them into the body area as a small toolbar at the top. This avoids cross-component header coordination.

**Recommendation:** Move TagsPane's +/- buttons into a small inline toolbar at the top of the body. The header becomes uniform across all panes.

### Step 5: Drag-to-reorder logic

**File:** `src/renderer/components/Sidebar.svelte`

```js
let dragOverPane = $state(null);
let dragOverPosition = $state(null); // 'before' | 'after'

function handleHeaderDragStart(e, paneKey) {
  e.dataTransfer.setData('application/x-noteliner-pane', paneKey);
  e.dataTransfer.effectAllowed = 'move';
}

function handleHeaderDragOver(e, paneKey) {
  // Only handle pane-reorder drags
  if (!e.dataTransfer.types.includes('application/x-noteliner-pane')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  dragOverPosition = y < rect.height / 2 ? 'before' : 'after';
  dragOverPane = paneKey;
}

function handleHeaderDragLeave() {
  dragOverPane = null;
  dragOverPosition = null;
}

function handleHeaderDrop(e, targetKey) {
  if (!e.dataTransfer.types.includes('application/x-noteliner-pane')) return;
  e.preventDefault();
  const draggedKey = e.dataTransfer.getData('application/x-noteliner-pane');
  dragOverPane = null;
  dragOverPosition = null;
  if (!draggedKey || draggedKey === targetKey) return;

  // Compute new order
  const newOrder = paneOrder.filter(k => k !== draggedKey);
  const targetIndex = newOrder.indexOf(targetKey);
  const insertAt = dragOverPosition === 'before' ? targetIndex : targetIndex + 1;
  newOrder.splice(insertAt, 0, draggedKey);

  if (onPaneReorder) onPaneReorder(newOrder);
}
```

**Visual feedback** (CSS):
- `.pane-header.drag-over-before` — top border accent
- `.pane-header.drag-over-after` — bottom border accent
- `.pane-header[draggable]` cursor: grab; while dragging: grabbing

### Step 6: App.svelte wiring

**File:** `src/renderer/App.svelte`

Add `paneOrder` to props passed to Sidebar:

```svelte
<Sidebar
  ...
  paneOrder={layout.paneOrder}
  onPaneReorder={(newOrder) => layout.paneOrder = newOrder}
/>
```

The existing debounced save `$effect` automatically picks up the change because it watches `JSON.stringify(layout)`.

When loading a saved layout that lacks `paneOrder` (older saves), `{ ...DEFAULT_LAYOUT, ...saved }` ensures the default order is used.

**Sanity check on restore:** If saved `paneOrder` contains unknown keys or is missing keys (e.g., a future version added a new pane), filter/append:

```js
const validKeys = ['files', 'tagGroups', 'outline', 'tags'];
let restored = saved.paneOrder?.filter(k => validKeys.includes(k)) ?? [];
const missing = validKeys.filter(k => !restored.includes(k));
layout.paneOrder = [...restored, ...missing];
```

This goes inside `loadProject()` after the layout is merged.

### Step 7: Resize logic adjustment

**File:** `src/renderer/components/Sidebar.svelte`

The resizer between two panes adjusts the pane **above** the resizer (since the bottom pane is `flex: 1` and absorbs the rest). Update `startResize` to take the pane above:

```js
function startResize(paneKeyAbove, currentHeight, minH) { ... }
```

The pane height keys remain `tagGroupsHeight`, `outlineHeight`, `tagsHeight` in `layout`. We also need a `filesHeight` if FILES is no longer the flex pane. Actually, since the LAST pane is always `flex: 1`, we use saved heights for all panes except the last visible one.

To avoid adding `filesHeight`, use a single derived map:

```js
function getHeightForPane(key) {
  switch (key) {
    case 'files': return layout.filesHeight ?? 200;
    case 'tagGroups': return layout.tagGroupsHeight;
    case 'outline': return layout.outlineHeight;
    case 'tags': return layout.tagsHeight;
  }
}
```

Add `filesHeight: 200` to `DEFAULT_LAYOUT`. It's only used when FILES isn't the last visible pane.

## File Change Summary

| File | Change |
|---|---|
| `src/renderer/styles/global.css` | Add shared `.pane-header` and `.pane-title` classes |
| `src/renderer/App.svelte` | Add `paneOrder` and `filesHeight` to `DEFAULT_LAYOUT`, pass to Sidebar with `onPaneReorder` callback, sanity-check restored order in `loadProject()` |
| `src/renderer/components/Sidebar.svelte` | Major refactor: render panes from `paneOrder` array, embed headers (with drag handlers), drag-to-reorder logic, resizer position logic |
| `src/renderer/components/TagGroupsPane.svelte` | Strip internal header — return body only |
| `src/renderer/components/OutlinePane.svelte` | Strip internal header — return body only |
| `src/renderer/components/TagsPane.svelte` | Strip internal header — move +/- buttons into a body toolbar |

## Design Decisions

1. **Last visible pane is flex.** Avoids ambiguity about which pane absorbs leftover space. Predictable: the bottom pane always grows. Saved heights are used for all panes above it.

2. **Headers owned by Sidebar, not pane components.** This keeps drag-and-drop logic in one place and ensures all headers share the exact same DOM structure for consistent height/styling. The pane components become pure body content.

3. **TagsPane +/- buttons move into body toolbar.** Avoids cross-component header coordination (which would need snippets or portals). A small toolbar inside the tags body is just as discoverable.

4. **Custom MIME type for pane drags.** Using `application/x-noteliner-pane` instead of `text/plain` prevents collision with the FileTree's existing `text/plain` drag (file UUIDs). The header drop handler only acts on its own MIME type; FileTree drags onto a header are ignored at the header level.

5. **paneOrder persisted per project, not globally.** Different projects may benefit from different layouts (e.g., a research project might want OUTLINE prominent; a tag-heavy project might want TAG GROUPS at top). Per-project storage already exists via `WindowStateService` — just add the field.

6. **Sanity check on restore.** Defends against future changes (added/removed panes) by filtering to known keys and appending missing ones. Prevents broken layouts after upgrades.

7. **Custom MIME type chosen carefully.** `application/x-noteliner-pane` is unique enough to avoid collision with any browser-native drag (text, files, html, etc.).
