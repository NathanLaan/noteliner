# NoteLiner Implementation Plan

## Assumptions

1. **Electron + Svelte stack**: The app will use Electron as the desktop shell with Svelte 5 for the UI framework, bundled via Vite.
2. **Git via CLI**: Git operations (clone, commit, push, pull) will be performed by spawning the system `git` CLI from the Electron main process, rather than using a JavaScript Git library. This keeps the implementation simple and relies on the user having Git installed.
3. **Single project at a time**: The app opens one project folder at a time. Opening a different folder replaces the current project.
4. **Markdown files are plain `.md` files**: Each file in the project is a standalone Markdown file stored at the root of the project directory.
5. **`noteliner.json` is the source of truth** for file ordering, hierarchy (parent/child relationships), and tags. The actual `.md` files on disk hold the content.
6. **FontAwesome Free** icons will be used for toolbar buttons.
7. **Markdown rendering** will use the `marked` library (or similar) for the preview panel.
8. **Syntax highlighting** in the editor will use CodeMirror 6 with a Markdown language mode.
9. **Debounced push**: After a local commit, a configurable debounce timer (default ~30 seconds) delays the `git push` to batch rapid changes.
10. **No authentication UI**: Git authentication (SSH keys or credential helpers) is assumed to already be configured on the user's machine.

## Scope

### In Scope
- Electron app shell with a single window
- Svelte-based UI with toolbar, sidebar, editor, preview panel, and log panel
- Open folder / create new project workflow
- `noteliner.json` index file management (create, read, update)
- File CRUD: create, rename, delete Markdown files
- Hierarchical file list with drag-and-drop reordering and re-parenting
- Markdown editor with basic syntax highlighting (CodeMirror 6)
- Markdown preview panel (show/hide toggle)
- Tag support per file (stored in `noteliner.json`)
- Git integration: init, clone, commit, pull, push
- Debounced auto-push to remote
- Sync log panel showing Git command output

### Out of Scope (for initial release)
- Multi-window / multi-project support
- Full-text search across files
- Collaborative / multi-user editing
- Git conflict resolution UI (conflicts will surface in the log panel)
- Custom themes or appearance settings
- File encryption
- Plugin system

## Technology Choices

| Component | Technology |
|---|---|
| Desktop shell | Electron |
| UI framework | Svelte 5 |
| Bundler | Vite (via `@sveltejs/vite-plugin-svelte`) |
| Code editor | CodeMirror 6 |
| Markdown preview | `marked` |
| Icons | FontAwesome Free |
| Git operations | System `git` CLI via `child_process` |
| Drag-and-drop | `sortablejs` (or Svelte-native DnD) |

## `noteliner.json` Schema

```json
{
  "version": 1,
  "files": [
    {
      "id": "uuid-string",
      "name": "My Note",
      "filename": "my-note.md",
      "parentId": null,
      "order": 0,
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

- `id`: Unique identifier for the file entry.
- `name`: Display name shown in the sidebar.
- `filename`: Actual filename on disk.
- `parentId`: `null` for top-level items, or the `id` of the parent item for nested items.
- `order`: Sort order among siblings.
- `tags`: Array of tag strings.

## Major Implementation Phases

### Phase 1: Project Scaffolding
- Initialize npm project with Electron, Svelte 5, and Vite
- Configure Electron main process and preload script
- Configure Vite for Svelte renderer
- Set up dev scripts (`npm run dev`, `npm run build`)
- Verify the app launches with a blank window

### Phase 2: App Layout and UI Shell
- Build the main window layout: left toolbar, resizable sidebar, center editor area, right preview panel, bottom log panel
- Implement resizable panel splitters
- Add FontAwesome icons to the toolbar
- Wire up toolbar button placeholders (Open Folder, New File, Show Log, About)
- Show an "Open" screen on first launch

### Phase 3: Project Management (Open / Create)
- Implement "Open Folder" dialog via Electron's `dialog.showOpenDialog`
- Detect if the selected folder is an existing NoteLiner project (`noteliner.json` exists)
- Load existing project: read `noteliner.json`, populate sidebar
- New project workflow: prompt for remote Git URL or create a new local Git repo
- Clone remote repo if URL provided
- Create `noteliner.json` if it doesn't exist
- Implement the "About" modal dialog

### Phase 4: File Management
- Create new Markdown file: generate entry in `noteliner.json`, create `.md` file on disk
- Display files in the sidebar as a hierarchical tree based on `parentId`/`order`
- Select a file to open it in the editor
- Rename files
- Delete files (remove from `noteliner.json` and disk)
- Drag-and-drop to reorder files and re-parent them within the tree

### Phase 5: Markdown Editor and Preview
- Integrate CodeMirror 6 with Markdown language support
- Load selected file content into the editor
- Auto-save content on change (debounced write to disk)
- Implement the right-side preview panel using `marked`
- Toggle preview panel visibility

### Phase 6: Git Sync Engine
- Implement Git service in the main process (spawn `git` commands)
- Auto-commit on file add, remove, or modify
- Debounced `git push` after commits (configurable timer)
- `git pull` on project open
- Stream Git command output to the log panel
- Toggle log panel visibility with saved height preference

### Phase 7: Polish and Packaging
- Error handling and user-facing error messages
- Edge cases: empty projects, missing Git, network failures
- Window state persistence (size, position, panel sizes)
- Electron app packaging for distribution
