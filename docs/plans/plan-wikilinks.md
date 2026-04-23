# Wikilinks and Backlinks

## Overview

Add `[[Note Name]]` wiki-style links that connect notes to each other. The editor offers autocomplete when the user types `[[`. The Preview renders wikilinks as clickable links that navigate to the target note (or offer to create it if missing). A new **Backlinks** pane — peer to Outline, Tags, TagGroups, and Search — shows every note that links *into* the currently-open note.

This turns a folder of markdown files into a connected knowledge graph without requiring users to adopt a new storage format.

## Current State

- **File identity:** Every note has a stable `id` (UUID) in `noteliner.json`, plus a human-visible `name` field (`project-service.js:132-140`).
- **Filename vs name:** `filename` is a slugified derivative (`project-service.js:319-324`); `name` is what the user typed. Users type names, not slugs, so wikilinks resolve by `name`.
- **Preview pipeline:** `Preview.svelte:49` calls `marked(editorContent)` and inserts the result via `{@html}`. `HistoryPanel.svelte` does the same for historical content. `main.js:427` and `main.js:466` use the same `marked()` call for HTML/PDF export.
- **Editor:** CodeMirror 6 is already wired up in `Editor.svelte` with `basicSetup`, markdown language, and custom themes. The `autocompletion` extension is a one-line addition since it comes with `basicSetup`.
- **Pane infrastructure:** `App.svelte` manages pane visibility and order via a `layout` object (`showOutline`, `showTags`, `showTagGroups`, `showSearch`, `paneOrder`). Adding a `showBacklinks` entry follows the established pattern.

## Design

### Link syntax

```
[[My Meeting Notes]]           → link to note named "My Meeting Notes"
[[My Meeting Notes|MMN]]       → link to that note, displayed as "MMN" (pipe-aliased)
[[Nonexistent Note]]           → dangling link, rendered distinctly, clickable to create
```

**Resolution rule:** case-insensitive exact match against `file.name`. If multiple notes share a name, the lexicographically first match wins (deterministic), and a warning is logged to the Log panel on link-graph build.

### Link graph

A `LinkGraph` lives in `project-service.js`:

```js
{
  outgoing: Map<fileId, Set<fileId>>,   // note A links to notes [B, C]
  incoming: Map<fileId, Set<fileId>>,   // note A is linked from notes [D, E]
  dangling: Map<fileId, Set<string>>    // note A has broken links to [names]
}
```

The graph is held in memory in the main process and rebuilt on project open. Not persisted — rebuilding scans all `.md` files with a regex, which is fast enough (milliseconds per thousand files). No schema change to `noteliner.json`.

### Mutation points

Every operation that changes linkable content updates the graph:

| Operation | Action on link graph |
|---|---|
| `writeFile` (content change) | Re-parse outgoing links for that file; diff against previous outgoing set to maintain incoming on all affected targets |
| `createFile` | Add empty outgoing entry; other files may now resolve dangling links to this new note — re-scan dangling names matching the new file's name |
| `deleteFile` | Drop from graph; any incoming links become dangling on the source files |
| `renameFile` | Links to the old name become dangling (we do NOT auto-rewrite — see "Why no auto-rewrite" below) |

### Why no auto-rewrite on rename

Auto-rewriting every `[[Old Name]]` to `[[New Name]]` across the repo would:

1. Generate a burst of git commits (one per file touched), polluting history.
2. Risk silent corruption if a link was ambiguous or if the new name already existed.
3. Violate the principle that the user's edits are authoritative.

Instead: on rename, we emit a log-panel warning listing all notes that had inbound links to the old name, and the Backlinks pane of the *renamed* note stays empty (because its old-name references are now dangling). The user can fix them manually or batch-fix via search-and-replace. If this friction proves painful, a "Update incoming links" follow-up button in the rename dialog is an easy V2.

### Autocomplete UX

When the user types `[[`, CodeMirror's `autocompletion` extension shows a filter-as-you-type popup sourced from `projectState.index.files.map(f => f.name)`. Selecting an option inserts the name plus the closing `]]`. If the user presses Escape or the popup closes without selection, nothing happens — the `[[` stays literal.

### Preview rendering

A custom `marked` extension turns `[[Name]]` and `[[Name|Alias]]` into:

```html
<a class="wikilink" data-wikilink="Name">Alias or Name</a>
<a class="wikilink dangling" data-wikilink="Name">Name</a>   <!-- unresolved -->
```

Styling:
- Resolved: `color: var(--accent)`, underline on hover.
- Dangling: `color: var(--text-muted)`, dashed underline. Tooltip: "Click to create".

The Preview pane's click handler catches clicks on `.wikilink`:
- Resolved → `projectState.selectFile(targetId)`.
- Dangling → prompt to create the note, then select it.

### Backlinks pane

```
┌────────────────────────────┐
│  BACKLINKS              ×  │
├────────────────────────────┤
│  Meeting 2026-04-01        │
│    > mentioned ...text...  │  <- snippet of the linking line
│  Q2 Planning               │
│    > see [[This Note]]     │
│                            │
│  (no backlinks)            │  <- empty state
└────────────────────────────┘
```

Each entry shows the linking note's name and a short snippet of the line containing the link (trimmed, with the wikilink highlighted). Clicking an entry selects that file and scrolls to the linking line (reuses `projectState.scrollToLine` which already exists for outline nav).

Snippets are generated on-demand when the pane renders, not cached — keeps the graph small. For a typical note with <20 backlinks, this is trivially fast.

## Implementation Steps

### Step 1: Link graph in the main process

**New file:** `src/main/link-graph-service.js`

```js
const WIKILINK_RE = /\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g;

class LinkGraphService {
  constructor(projectService) {
    this.projectService = projectService;
    this.outgoing = new Map();
    this.incoming = new Map();
    this.dangling = new Map();
  }

  async rebuild() {
    this.outgoing.clear();
    this.incoming.clear();
    this.dangling.clear();
    const nameToId = this.buildNameIndex();
    for (const file of this.projectService.index.files) {
      await this.scanFile(file, nameToId);
    }
  }

  async scanFile(file, nameToId = this.buildNameIndex()) {
    const content = await this.projectService.readFile(file.filename);
    const targets = new Set();
    const dangling = new Set();
    for (const match of content.matchAll(WIKILINK_RE)) {
      const name = match[1].trim();
      const targetId = nameToId.get(name.toLowerCase());
      if (targetId) targets.add(targetId);
      else dangling.add(name);
    }
    this.updateIndexForFile(file.id, targets, dangling);
  }

  getBacklinks(fileId) {
    return [...(this.incoming.get(fileId) || new Set())];
  }

  getBacklinkSnippets(fileId) {
    // Read each incoming source file, find lines containing the link
    // Return [{ sourceId, sourceName, line, text }]
  }

  buildNameIndex() {
    const map = new Map();
    for (const file of this.projectService.index.files) {
      map.set(file.name.toLowerCase(), file.id);
    }
    return map;
  }

  updateIndexForFile(fileId, newOutgoing, newDangling) {
    const prev = this.outgoing.get(fileId) || new Set();
    for (const targetId of prev) this.incoming.get(targetId)?.delete(fileId);
    this.outgoing.set(fileId, newOutgoing);
    for (const targetId of newOutgoing) {
      if (!this.incoming.has(targetId)) this.incoming.set(targetId, new Set());
      this.incoming.get(targetId).add(fileId);
    }
    this.dangling.set(fileId, newDangling);
  }
}

module.exports = { LinkGraphService };
```

### Step 2: IPC handlers and preload bindings

**`src/main/main.js`** — add three handlers:

```js
ipcMain.handle('links:getBacklinks', async (_e, fileId) => linkGraphService.getBacklinkSnippets(fileId));
ipcMain.handle('links:getAllNames', async () => projectService.index.files.map(f => f.name));
ipcMain.handle('links:rebuild', async () => linkGraphService.rebuild());
```

Call `linkGraphService.rebuild()` inside `openProject` and `initProject` after the index is loaded.

Hook into existing mutation points (call `linkGraphService.scanFile(entry)` after `writeFile`, `.rebuild()` after `createFile`/`deleteFile`/`renameFile` — rebuild is cheap and handles the dangling-link revival cases for free).

**`src/main/preload.js`:**

```js
getBacklinks: (fileId) => ipcRenderer.invoke('links:getBacklinks', fileId),
getAllNoteNames: () => ipcRenderer.invoke('links:getAllNames'),
```

### Step 3: Preview rendering

**`src/renderer/components/Preview.svelte`:**

```js
import { marked } from 'marked';

const nameToId = $derived.by(() => {
  const m = new Map();
  for (const f of projectState.index.files) m.set(f.name.toLowerCase(), f.id);
  return m;
});

const wikilinkExtension = {
  name: 'wikilink',
  level: 'inline',
  start(src) { return src.indexOf('[['); },
  tokenizer(src) {
    const match = /^\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/.exec(src);
    if (match) return { type: 'wikilink', raw: match[0], name: match[1].trim(), alias: match[2]?.trim() };
  },
  renderer(token) {
    const resolved = nameToId.has(token.name.toLowerCase());
    const cls = resolved ? 'wikilink' : 'wikilink dangling';
    const label = token.alias || token.name;
    return `<a class="${cls}" data-wikilink="${escapeHtml(token.name)}">${escapeHtml(label)}</a>`;
  }
};

marked.use({ extensions: [wikilinkExtension] });
```

Add a click handler on the preview container:

```js
function handlePreviewClick(e) {
  const link = e.target.closest('.wikilink');
  if (!link) return;
  e.preventDefault();
  const name = link.dataset.wikilink;
  const id = nameToId.get(name.toLowerCase());
  if (id) projectState.selectFile(id);
  else onCreateFromLink(name);  // new prop — App.svelte opens NewFileModal prefilled
}
```

### Step 4: Editor autocomplete

**`src/renderer/components/Editor.svelte`:**

```js
import { autocompletion } from '@codemirror/autocomplete';

function wikilinkCompletions(context) {
  const word = context.matchBefore(/\[\[([^\]]*)/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const typed = word.text.slice(2).toLowerCase();
  const options = projectState.index.files
    .filter(f => f.name.toLowerCase().includes(typed))
    .map(f => ({ label: f.name, apply: `${f.name}]]` }));
  return { from: word.from + 2, options };
}

// Add to extensions array:
autocompletion({ override: [wikilinkCompletions] }),
```

### Step 5: Backlinks pane

**New file:** `src/renderer/components/BacklinksPane.svelte`

Props: `onSelect(fileId, line)`, `onClose`.

Behavior:
- `$effect`: when `projectState.selectedFileId` changes, call `window.api.getBacklinks(selectedFileId)` and store the result.
- Render as a list. Empty state: "No notes link here yet."
- Each entry: source note name + snippet. Click → `onSelect(sourceId, line)`, which in App.svelte selects the file and sets `projectState.scrollToLine = line` (existing mechanism for Outline nav).

### Step 6: Wire into App layout

**`src/renderer/App.svelte`:**

- Add `showBacklinks: false` to `layout`.
- Add `'backlinks'` to `paneOrder` (default position: after `tags`).
- Render `<BacklinksPane>` in the pane-order loop alongside Outline, Tags, etc.
- Add menu/keyboard shortcut: `Ctrl+Shift+B` toggles it.

### Step 7: Dangling-link creation flow

When the user clicks a dangling wikilink, open `NewFileModal` with `name` pre-filled. After creation, `linkGraphService.rebuild()` runs (via the existing post-create hook), which promotes the dangling link to resolved everywhere that referenced it.

## Edge Cases

- **Unicode in names:** The regex allows anything except `[`, `]`, `|`. Case-insensitive comparison uses `toLowerCase()`; accept that Turkish `i` quirks may cause rare mismatches. Document behavior; do not attempt ICU folding.
- **Duplicate names:** First match by insertion order wins. Log a warning once per rebuild naming both files and suggesting a rename.
- **Self-links (`[[This Same Note]]`):** Render normally; don't include the note in its own backlinks.
- **Wikilinks inside code blocks / fences:** The marked extension only fires outside code context because marked processes code blocks first. Verify this; if not, extend the tokenizer to check token context.
- **Performance on large repos:** Full rebuild on a 10k-note repo reads every file. Should stay under 1 second even on a hard drive. If not, defer to a background thread in the main process.

## Testing

1. Create three notes; link from A to B and C; verify Backlinks on B and C show A.
2. Type `[[` in the editor — autocomplete list appears, filters as you type.
3. Click a dangling link — NewFileModal opens with pre-filled name.
4. Rename a linked note — verify warning appears in Log panel and inbound links show as dangling.
5. Create a note with the same name as a previously-dangling target — verify it auto-resolves after next rebuild.
6. HTML/PDF export: wikilinks should render as styled text (they're just `<a>` tags — verify the export CSS includes a basic `.wikilink` style so they read as links, not invisible).

## Out of Scope (V1)

- Graph visualization (force-directed, etc.) — potential V2.
- `[[Note#Heading]]` anchor links — potential V2.
- `[[Note|Alias]]` search inside aliases — V1 only searches names.
- Automatic inbound-link rewriting on rename — intentionally deferred (see "Why no auto-rewrite").

## Rollout

No schema migration. Ship in one PR. On first open after upgrade, `linkGraphService.rebuild()` runs automatically during project-load — transparent to the user.
