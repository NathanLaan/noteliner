# Associated Files Feature

## Overview

Allow users to paste/attach files into the app and associate them with the currently open text file. Associated files are stored as separate files in the project directory and tracked in the project index. A new right sidebar displays the list of associated files, showing thumbnails for images and filename/type for other files.

## Index Schema Change

Add an `attachments` array to each file entry in `noteliner.json`:

```json
{
  "version": 2,
  "files": [
    {
      "id": "uuid",
      "name": "My Note",
      "filename": "my-note.md",
      "parentId": null,
      "order": 0,
      "tags": [],
      "attachments": [
        {
          "id": "uuid",
          "originalName": "screenshot.png",
          "filename": "att-<shortid>.png",
          "mimeType": "image/png",
          "size": 102400,
          "addedAt": "2026-04-10T12:00:00Z"
        }
      ]
    }
  ]
}
```

**Design decisions:**

- Attachments live inside their parent file entry rather than as top-level objects, keeping the relationship explicit and avoiding a separate join structure.
- Stored filenames use a short prefix (`att-`) plus a truncated UUID to avoid collisions and keep paths predictable.
- The original filename is preserved for display.
- `mimeType` is derived from the file extension at paste time.
- Bump index version to `2`. On load, migrate v1 indexes by adding empty `attachments: []` to each file entry.

## File Storage

Attachments are stored in an `_attachments/` subdirectory within the project folder:

```
project/
  noteliner.json
  my-note.md
  _attachments/
    att-a1b2c3d4.png
    att-e5f6g7h8.pdf
```

**Rationale:** A dedicated subdirectory keeps the project root clean (text files only) and makes `.gitignore` rules simple if users want to exclude large binaries.

## Implementation Steps

### Step 1: Backend - ProjectService changes

**File:** `src/main/project-service.js`

1. **Index migration:** In `openProject()`, after reading `noteliner.json`, check if `index.version < 2`. If so, iterate all file entries adding `attachments: []` and set `version: 2`. Save the updated index.

2. **`addAttachment(fileId, fileBuffer, originalName)`:**
   - Reject if `fileBuffer` exceeds 30MB (31,457,280 bytes). Throw an error with a clear message.
   - Validate `fileId` exists in the index.
   - Generate attachment ID (short UUID).
   - Derive extension from `originalName`.
   - Derive mimeType from extension using a simple lookup map (no external dependency).
   - Construct stored filename: `att-<shortId>.<ext>`.
   - Ensure `_attachments/` directory exists.
   - Write `fileBuffer` to `_attachments/<storedFilename>`.
   - Push attachment metadata onto the file entry's `attachments` array.
   - Save index, git commit.
   - Return the new attachment metadata object.

3. **`removeAttachment(fileId, attachmentId)`:**
   - Find file entry and attachment within it.
   - Delete the file from `_attachments/`.
   - Remove from the attachments array.
   - Save index, git commit.

4. **`getAttachmentPath(filename)`:**
   - Return the absolute path to `_attachments/<filename>` for reading by the renderer.

### Step 2: Backend - IPC handlers

**File:** `src/main/main.js`

Add three new IPC handlers:

```
file:addAttachment    (fileId, buffer, originalName) -> attachment metadata
file:removeAttachment (fileId, attachmentId)         -> void
file:getAttachmentPath (filename)                    -> absolute file path
```

**File:** `src/main/preload.js`

Expose corresponding methods on `window.api`:

```
addAttachment(fileId, buffer, originalName)
removeAttachment(fileId, attachmentId)
getAttachmentPath(filename)
```

### Step 3: Frontend - Project store changes

**File:** `src/renderer/stores/project.svelte.js`

1. Add `addAttachment(fileId, attachment)` - pushes to the file entry's attachments array in local state.
2. Add `removeAttachment(fileId, attachmentId)` - removes from local state.
3. Add getter `selectedFileAttachments` - returns attachments for the currently selected file (or empty array).

### Step 4: Frontend - Paste and drop handling in Editor

**File:** `src/renderer/components/Editor.svelte`

**Paste handling:** Add a `paste` event listener on the editor container:

1. Check `event.clipboardData.files` for pasted files.
2. If files are present, prevent default.
3. For each file:
   - Reject files over 30MB with a user-facing error (e.g. log panel message or alert).
   - Read as `ArrayBuffer` via `FileReader`.
   - Call `window.api.addAttachment(selectedFileId, buffer, file.name)`.
   - Update local store with returned metadata.
   - Insert a markdown reference at the cursor position (see Step 4b).
4. Ignore paste events with no files (let CodeMirror handle normal text paste).

**Drag-and-drop handling:** Add `dragover` and `drop` event listeners on the editor container:

1. On `dragover`: call `preventDefault()` and set `dropEffect = 'copy'`.
2. On `drop`: read `event.dataTransfer.files`, process each file using the same logic as paste (size check, upload, store update, markdown insertion).

### Step 4b: Markdown reference insertion

When a file is attached (via paste, drop, or the file dialog), insert a markdown reference into the editor at the current cursor position:

- **Images** (png, jpg, jpeg, gif, webp, svg): Insert `![originalName](./_attachments/storedFilename)`
- **Other files**: Insert `[originalName](./_attachments/storedFilename)`

Use CodeMirror's `dispatch` API to insert text at the current selection. This allows the reference to appear in the markdown preview. Users can delete the inserted reference if they prefer to keep attachments only in the sidebar.

### Step 5: Frontend - AttachmentPanel component

**New file:** `src/renderer/components/AttachmentPanel.svelte`

A right sidebar panel displaying associated files for the selected note.

**Layout:**
```
+---------------------------+
| ATTACHMENTS         [+]  |  <- header with add button
+---------------------------+
| [thumb] screenshot.png    |  <- image: thumbnail + name
| [icon]  report.pdf        |  <- non-image: file type icon + name
| [icon]  data.csv          |
+---------------------------+
```

**Behavior:**
- **Images** (png, jpg, jpeg, gif, webp, svg): Show a thumbnail loaded via the attachment path. Display original filename below/beside.
- **Other files**: Show a file-type icon (from FontAwesome: `fa-file-pdf`, `fa-file-csv`, `fa-file-word`, etc., falling back to `fa-file`) and the original filename.
- **Add button** `[+]`: Opens a native file dialog (`window.api.openFileDialog`) to attach files manually (not just via paste).
- **Delete**: Right-click context menu or hover delete button on each item. Confirms before removing.
- **Click**: Opens the file using the system default application (via Electron `shell.openPath`).

**Thumbnail loading:**
- Use `window.api.getAttachmentPath(filename)` to get the absolute path.
- Convert to a `file://` protocol URL or read as base64 data URL for the `<img>` src.
- Limit thumbnail dimensions to fit the sidebar (e.g., max-width 100%, max-height 120px).

### Step 6: Frontend - Layout integration

**File:** `src/renderer/App.svelte`

1. Add `showAttachments` state variable (default `false`).
2. Add the `AttachmentPanel` to the right of the editor area, with a resizer (same pattern as the existing sidebar/preview resizers).
3. When `showPreview` is also active, the attachment panel appears to the right of the preview pane.

**Updated layout:**
```
Toolbar | Sidebar | Resizer | Editor | [Resizer | Preview] | [Resizer | AttachmentPanel]
```

4. Add `handleToggleAttachments()` function.
5. Pass it to Toolbar.

### Step 7: Frontend - Toolbar button

**File:** `src/renderer/components/Toolbar.svelte`

Add a new button in the toolbar (above the spacer, below "New File"):

- **Icon:** `fa-paperclip` (paperclip, standard attachment icon)
- **Tooltip:** `"Attachments (Ctrl+B)"`
- **Visibility:** Only when a project is open (same as "New File")
- **Behavior:** Toggles `showAttachments`

### Step 8: Keyboard shortcut

**File:** `src/renderer/App.svelte`

Add `Ctrl+B` to the global keydown handler to toggle the attachment panel.

**Rationale:** `Ctrl+B` is not currently bound. "B" is not strongly mnemonic but it's ergonomic and avoids conflicts with standard shortcuts.

### Step 9: File dialog for manual attachment

**File:** `src/main/main.js`

Add a new IPC handler `dialog:openFiles` that opens a native file picker with `multiSelections` enabled and returns an array of `{ buffer, name }` objects.

**File:** `src/main/preload.js`

Expose `openFileDialog()` on `window.api`.

### Step 10: Theme variables

**File:** `src/renderer/stores/theme.svelte.js`

Add CSS variables for the attachment panel:

- `--attachment-panel-bg`: Background for the panel (reuse `--bg-surface`)
- No new variables needed if existing theme variables are sufficient. Evaluate during implementation.

## File Change Summary

| File | Change |
|---|---|
| `src/main/project-service.js` | Index migration, `addAttachment` (with 30MB limit), `removeAttachment`, `getAttachmentPath`, mime lookup |
| `src/main/main.js` | 4 new IPC handlers |
| `src/main/preload.js` | 4 new API methods |
| `src/renderer/stores/project.svelte.js` | Attachment state methods and getter |
| `src/renderer/components/Editor.svelte` | Paste listener, drop listener, markdown reference insertion |
| `src/renderer/components/AttachmentPanel.svelte` | **New file** |
| `src/renderer/components/Toolbar.svelte` | New toggle button |
| `src/renderer/App.svelte` | Layout, state, keyboard shortcut |
| `src/renderer/stores/theme.svelte.js` | New variables if needed |

## Design Decisions

1. **Git and large files:** Leave as a user concern for now. No LFS or `.gitattributes` automation.
2. **Max file size:** 30MB per attachment. Enforced in both backend (ProjectService rejects) and frontend (pre-check before upload). User sees a clear error message.
3. **Drag-and-drop:** Supported. Dragging files onto the editor area triggers the same attachment flow as paste.
4. **Attachment ordering:** Chronological by `addedAt`. No manual reordering.
5. **Markdown reference insertion:** On attach, insert a markdown reference at the cursor — `![name](path)` for images, `[name](path)` for other files. Users can delete these if they prefer attachments only in the sidebar.
