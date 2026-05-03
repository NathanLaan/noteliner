# Command Palette — Implementation Plan

## Status

**Completed 2026-05-02.** All four item kinds (commands, notes, tags,
recent projects) shipped, plus matched-substring highlighting and inter-
kind dividers. Theme switching is now palette-driven via three commands.

**Shipped:**
- `src/renderer/stores/commands.svelte.js` — central registry with
  `register`, `dispatchKeyEvent`, applicability gating, recently-used.
- `src/renderer/lib/fuzzy.js` — small fuzzy scorer.
- `src/renderer/components/CommandPalette.svelte` — centered modal,
  `Ctrl+K` / `Ctrl+Shift+P`, ↑/↓/Home/End/Enter/Esc keyboard nav.
- `App.svelte` keyboard handler now dispatches via `commandRegistry` —
  shortcuts are SoT in the registry.
- `SettingsModal.svelte` shortcuts list derives from the registry; the
  static `shortcuts` array is gone (auto-memory updated accordingly).
- Recently-used IDs persisted to `ui-preferences.json` (debounced).
- 31 commands registered across File / View / Tags / Project / Theme / App
  sections.
- All four item kinds: commands, notes, tags (jump to first file with
  tag), recent projects (open via callback to `handleOpenRecent`).
- Matched-substring highlighting via `<mark>` with accent-tinted
  background; brighter tint on selected row.
- Section dividers between kind transitions in the result list.
- Visibility pass after first ship: backdrop uses `--modal-overlay`,
  body uses `--bg-surface` (was a `--bg-elevated` typo); blur + ring +
  taller input + accent-bar selection.
- Smoke tests: open/filter/close + Enter-dispatch
  (`tests/e2e/06-command-palette.spec.js`).

**Deferred:**
- Multi-step palette flows ("Open File ›" with sub-list). Out of scope
  per the plan.
- User-defined commands / macros. Out of scope per the plan.
- Toolbar buttons still call handlers directly rather than going through
  `commandRegistry.run(id)` — works fine, low value to refactor.

## Overview

Add a `Ctrl+K` (also `Ctrl+Shift+P`) command palette: a centered, modal,
filter-as-you-type list of every action in the app, plus quick-jump to any
note. The palette unifies the growing list of toolbar buttons and shortcuts
behind a single discoverable surface, and lets keyboard-first users skip
hunting through menus.

This addresses the "command palette" gap flagged in the comparison report
versus Tolaria.

## Goals

1. One keyboard surface for every action — open file, run any toolbar/menu
   action, jump to a tag, switch theme, toggle a pane.
2. Fuzzy matching against action labels and (optionally) filenames.
3. Discoverability: actions display their keyboard shortcut, so the palette
   *teaches* shortcuts as a side effect.
4. No new infrastructure — everything the palette dispatches is already a
   function in the renderer.

## Current State

- **Actions are scattered.** Toolbar buttons in `Toolbar.svelte`, modal
  triggers in `App.svelte`, keyboard shortcuts handled in `App.svelte`'s
  `onkeydown` handler. There is no central registry.
- **Existing shortcut surface** documented in `SettingsModal.svelte`'s
  shortcuts array (per the existing memory note: keep that array updated
  when we add bindings here).
- **Modal pattern:** Existing modals (`NewFileModal`, `SettingsModal`, etc.)
  use a consistent overlay + close-on-Esc pattern. Reuse it.
- **File search:** `SearchPane.svelte` already does full-text content
  search. The palette only needs *filename/title* fuzzy match — a different,
  simpler concern.

## Design

### Trigger

- `Ctrl+K` (primary).
- `Ctrl+Shift+P` (secondary, matches VS Code muscle memory).
- A new toolbar icon (fa-magnifying-glass or fa-bolt) — optional,
  discoverable for non-keyboard users.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  [🔍] Type a command or note name...               [Esc] │
├──────────────────────────────────────────────────────────┤
│  > New File                                Ctrl+N        │
│    Open Folder                             Ctrl+O        │
│    Toggle Preview                          Ctrl+P        │
│  ─── Notes ───                                            │
│    Q3 Planning                                            │
│    Meeting 2026-04-29                                     │
│    Inbox                                                  │
│  ─── Tags ───                                             │
│    #meetings                                              │
│    #hr                                                    │
└──────────────────────────────────────────────────────────┘
```

- 600px wide, centered, max ~12 results visible, scrollable.
- Empty input shows: recently used commands at top, then "Notes" section
  (last 5 opened), then "All Commands."
- Sections collapse when not relevant (e.g., a query of "ne" hides the Tags
  section if no tag matches).

### Item types

| Kind | Source | Action on Enter |
|---|---|---|
| `command` | Static action registry | Invoke the action |
| `note` | `projectState.index.files` | Select that note |
| `tag` | Derived from index | Filter file tree to that tag |
| `theme` | `themeState` | Switch theme |
| `recent-project` | `getRecentProjects()` | Open that project |

### Fuzzy match

Simple subsequence match with a small score:

- Exact prefix on label → highest score.
- Word-boundary match (`tp` → `Toggle Preview`) → next.
- Subsequence match → lowest.
- Tie-break by recently-used.

A 50-line implementation; no `fuzzaldrin` / `fuse.js` dependency for v1.

### Recently used

Store the last 8 invoked command IDs in `ui-preferences.json` (global). On
empty query, those float to the top.

## Implementation Steps

### Step 1: Action registry

**New file:** `src/renderer/stores/commands.svelte.js`

```js
// Each command is { id, label, section, shortcut, when, run }
// `when` returns true if the command is currently applicable
// (e.g., "Toggle Preview" requires a project to be open).

export const commandRegistry = $state({ commands: [] });

export function registerCommand(cmd) {
  commandRegistry.commands.push(cmd);
}

export function unregisterCommand(id) {
  const i = commandRegistry.commands.findIndex(c => c.id === id);
  if (i >= 0) commandRegistry.commands.splice(i, 1);
}
```

`App.svelte` registers every action it owns at mount:

```js
registerCommand({
  id: 'file.new',
  label: 'New File',
  section: 'File',
  shortcut: 'Ctrl+N',
  when: () => projectState.isOpen,
  run: () => { showNewFile = true; }
});
registerCommand({
  id: 'view.togglePreview',
  label: 'Toggle Preview',
  section: 'View',
  shortcut: 'Ctrl+P',
  when: () => projectState.isOpen,
  run: () => { layout.showPreview = !layout.showPreview; }
});
// ... ~25 more
```

The registry is the **single source of truth** for shortcuts going forward.
The keyboard handler in `App.svelte` looks up `shortcut` matches in the
registry and calls `run()` — the same path the palette uses. This kills the
divergence between toolbar/menu/shortcut handlers that exists today.

### Step 2: Palette component

**New file:** `src/renderer/components/CommandPalette.svelte`

```svelte
<script>
  import { commandRegistry } from '../stores/commands.svelte.js';
  import { projectState } from '../stores/project.svelte.js';
  import { uiPrefs } from '../stores/ui-prefs.svelte.js';
  import { fuzzyScore } from '../lib/fuzzy.js';

  let { onClose } = $props();
  let query = $state('');
  let selectedIndex = $state(0);
  let inputEl;

  $effect(() => { inputEl?.focus(); });

  const items = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const cmds = commandRegistry.commands
      .filter(c => !c.when || c.when())
      .map(c => ({ kind: 'command', label: c.label, sub: c.shortcut, run: c.run, score: q ? fuzzyScore(c.label, q) : 0 }));
    const notes = projectState.isOpen
      ? projectState.index.files.map(f => ({
          kind: 'note', label: f.name, sub: '',
          run: () => projectState.selectFile(f.id),
          score: q ? fuzzyScore(f.name, q) : 0
        }))
      : [];
    const all = [...cmds, ...notes].filter(it => !q || it.score > 0);
    if (q) all.sort((a, b) => b.score - a.score);
    else /* empty-query ordering: recents, then alphabetical */;
    return all.slice(0, 50);
  });

  function onKeydown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { selectedIndex = Math.min(selectedIndex + 1, items.length - 1); e.preventDefault(); }
    if (e.key === 'ArrowUp') { selectedIndex = Math.max(selectedIndex - 1, 0); e.preventDefault(); }
    if (e.key === 'Enter') {
      items[selectedIndex]?.run();
      uiPrefs.recordCommand(items[selectedIndex]?.id);
      onClose();
    }
  }
</script>

<div class="palette-backdrop" onclick={onClose}>
  <div class="palette" onclick={e => e.stopPropagation()} onkeydown={onKeydown}>
    <input bind:this={inputEl} bind:value={query} placeholder="Type a command or note name..." />
    <ul>
      {#each items as it, i}
        <li class:selected={i === selectedIndex} onclick={() => { it.run(); onClose(); }}>
          <span class="kind">{it.kind === 'command' ? '›' : it.kind === 'note' ? '📄' : '#'}</span>
          <span class="label">{it.label}</span>
          {#if it.sub}<span class="sub">{it.sub}</span>{/if}
        </li>
      {/each}
    </ul>
  </div>
</div>
```

(Production version highlights the matched substring, sections the list,
displays recents, etc.)

### Step 3: Mount in App

```js
// App.svelte
let showPalette = $state(false);

function onkeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { showPalette = true; e.preventDefault(); }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { showPalette = true; e.preventDefault(); }
  // ... existing handlers
}
```

```svelte
{#if showPalette}
  <CommandPalette onClose={() => showPalette = false} />
{/if}
```

### Step 4: Migrate existing handlers to use the registry

Goal: there is exactly one place a shortcut, toolbar button, or palette
entry resolves to its action. Today shortcuts live inline in `App.svelte`'s
keyboard handler and toolbar buttons live inline in `Toolbar.svelte`. After
migration:

- `App.svelte`'s keyboard handler iterates the registry: for each `cmd`
  with a `shortcut`, parse the shortcut string and dispatch on match.
- `Toolbar.svelte` becomes a list of *command IDs*; clicking a button
  dispatches `commandRegistry.run(id)`.
- The shortcuts array in `SettingsModal.svelte` is **derived** from the
  registry rather than hand-maintained — closes the existing memory item
  about keeping it in sync.

This is the highest-value cleanup in the whole plan, but it is a refactor.
If it slips v1, palette can ship without it (just duplicate the action
inside `run()` callbacks); but the duplication will rot.

### Step 5: Recently-used persistence

Add to `ui-preferences.json`:

```json
{
  "commandPalette": { "recentIds": ["file.new", "view.togglePreview", ...] }
}
```

Capacity 8, FIFO. Loaded at app start; saved (debounced 500ms) on every
invocation.

### Step 6: Style + theme

Match existing modal styling (`background: var(--bg-elevated)`,
`border: 1px solid var(--border)`). Selected row uses `--accent` background
at 15% opacity. Match height to ~36 rows max viewport on a 720p screen.

## Edge Cases

- **No project open:** Filter out commands whose `when()` returns false.
  Show project-level commands only ("Open Folder", "Open Recent…", "About",
  "Settings").
- **Modal already open:** `Ctrl+K` should still open the palette? **No** —
  if any modal is showing, swallow `Ctrl+K`. Palette over palette is bad.
- **Inside the editor:** CodeMirror has its own keymap. Our handler runs at
  document level on capture, so `Ctrl+K` reaches us before CodeMirror sees
  it. Verify with editor focused; if CodeMirror grabs it, add an explicit
  precedence binding via `keymap.of`.
- **macOS:** `Ctrl` → `Cmd`. Use `e.metaKey || e.ctrlKey` everywhere.
- **Many notes:** 10k notes × scoring on every keystroke is fine in JS
  (microseconds), but rendering 10k DOM nodes is not. Cap the rendered list
  at 50; the score function rejects everything else.

## Testing

1. `Ctrl+K` opens palette; `Esc` closes; clicking outside closes.
2. Type "new" → "New File" appears, `Enter` opens the New File modal.
3. Type a partial filename → matching notes appear under "Notes" section.
4. Empty query → most recently invoked 5 commands show on top.
5. With no project open, "New File" does not appear; "Open Folder" does.
6. Activating a command via shortcut updates its recently-used rank (so the
   palette and the keyboard shortcut share state).
7. Adding a new toolbar action and registering it makes it appear in the
   palette automatically — no second registration step.

## Out of Scope (V1)

- **Multi-step palette flows** (e.g., "Open File ›" then sub-list of files).
  V1 is one-shot dispatch.
- **Custom user-defined commands** (macros). Out of scope.
- **Theming the palette per-user.** It uses the active theme.
- **Command arguments** (e.g., "Set Theme" with an inline picker). Use
  separate command IDs per theme for now (`theme.midnight`, `theme.dark`,
  `theme.light`).

## Rollout

No schema migration. Ship in one PR. Existing shortcuts continue to work
identically because the registry-backed dispatcher behaves the same.
