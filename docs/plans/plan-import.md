# Document Import — Implementation Plan

## Overview

Add an "Import Document" feature that ingests an existing file (v1: `.docx`)
and creates a new note in the current NoteLiner project with the body
converted to Markdown. Images embedded in the source document become
NoteLiner attachments. The imported note is committed like any other file,
so the import itself is versioned.

## Goals

- **v1 format:** Microsoft Word `.docx` (Office Open XML).
- **Preserve** paragraphs, headings (H1–H6), bold, italics, hyperlinks,
  ordered and unordered lists (including nesting).
- **Skip** tables — emit a placeholder or simply strip them, with a log entry.
- **Images:** extract embedded images from the docx, store them as
  NoteLiner attachments in `_attachments/`, and reference them via standard
  Markdown image syntax.
- Imports run **entirely offline** in the Electron main process — no external
  binaries, no network calls.

## Non-goals (v1)

- Legacy `.doc` (binary format, different parser needed).
- Rich Text Format (`.rtf`), OpenDocument (`.odt`), PDF, HTML.
- Tables (deferred; the output is placeholder text).
- Text boxes, SmartArt, equations, footnotes, endnotes, comments, tracked
  changes, embedded objects (OLE).
- Styles beyond what Markdown can express (colors, fonts, sizes).
- Headers/footers, page breaks, section breaks.

These can arrive in later phases; keeping v1 tight prevents scope creep.

## Current State

- **Files are created via `projectService.createFile(name, tags)`** — writes
  a default `# <name>\n` body and registers the file in `noteliner.json`.
- **Attachments are added via `projectService.addAttachment(fileId, buffer, originalName)`**
  — stores under `_attachments/att-<id>.<ext>`, returns an `{id, filename, ...}`
  record, and auto-commits.
- **30MB attachment cap** (`MAX_ATTACHMENT_SIZE` in project-service.js) applies
  per attachment.
- **No import code exists.** No `.docx` parsing dependency.

## Library Options

### Option A — `mammoth` (recommended)

Pure-JS, MIT-licensed `.docx` → HTML/Markdown converter. Actively maintained.
Handles the exact element set the user listed.

**Pros**
- Zero native deps — works unchanged in Electron's main process.
- Built-in `convertToMarkdown()`; supports custom style maps to override
  defaults.
- `convertImage` hook gives direct access to image buffers — perfect fit for
  routing images through `addAttachment()`.
- Handles lists (nested), links, bold/italics, headings out of the box.
- Small: ~1MB installed.

**Cons**
- Markdown output is minimal-by-design; fancy Word constructs get dropped,
  which is fine given our non-goals.
- Default markdown renderer doesn't emit GFM tables — but since we're
  stripping tables anyway, not an issue.

### Option B — `pandoc` (external binary)

Best-in-class conversion quality. But requires the user to install `pandoc`
separately, which breaks "works out of the box" for a packaged Electron app.
Could be a fallback option later, not v1.

### Option C — `docx-preview` + custom markdown serializer

`docx-preview` is a rendering library; we'd write our own HTML-to-markdown
step. More work than mammoth for no gain.

### Option D — Parse `document.xml` directly

Full control, but OOXML is enormous and getting lists right alone is days of
work. Not worth it.

**Decision:** ship mammoth in v1.

## Element Mapping

| Word element | Source in OOXML | Mammoth default | v1 target |
|---|---|---|---|
| Paragraph | `<w:p>` | `<p>` → blank-line block | Blank-line-separated paragraph |
| Heading 1–6 | `<w:pStyle w:val="Heading1">` etc. | `#` … `######` | Keep as-is |
| Bold | `<w:b/>` run prop | `**text**` | Keep as-is |
| Italic | `<w:i/>` run prop | `*text*` | Keep as-is |
| Hyperlink | `<w:hyperlink>` | `[text](url)` | Keep as-is |
| Bulleted list | `numId` → `numbering.xml` list def | `-` items with indent | Keep as-is |
| Numbered list | same, with `<w:numFmt w:val="decimal"/>` | `1.` items with indent | Keep as-is |
| Table | `<w:tbl>` | HTML `<table>` fallback | **Strip**; insert `> [Table omitted during import]` placeholder and log a warning |
| Image | `<w:drawing>` → relationship → `word/media/*` | `<img src="data:..."/>` | Route through `addAttachment()`; emit `![alt](./_attachments/att-<id>.<ext>)` |
| Everything else | various | varies | Let mammoth do its default; log any `messages` mammoth reports |

### Style map

Pass a small custom `styleMap` to mammoth so we normalize:
```
p[style-name='Heading 1'] => h1:fresh
p[style-name='Heading 2'] => h2:fresh
...
p[style-name='Quote']     => blockquote:fresh
```

This handles localized style names and templates that rename the built-in
heading styles.

### Post-processing

After `convertToMarkdown`, run a small cleanup pass:
1. Strip/replace tables (see below).
2. Collapse runs of 3+ blank lines to 2.
3. Trim trailing whitespace.
4. Ensure the doc starts with a single `# <title>` (derived from the source
   filename) if mammoth didn't emit an H1.

#### Table stripping

Easier to handle at the **HTML stage** than markdown, because mammoth emits
`<table>` HTML blocks when it can't produce markdown for them. Plan:
- Run `convertToHtml` instead of `convertToMarkdown`.
- Regex-replace `<table[\s\S]*?</table>` with a placeholder paragraph.
- Pass the cleaned HTML through a small HTML→Markdown step (`turndown`) — or
  keep `convertToMarkdown` and use mammoth's `transformDocument` to drop
  table elements before conversion. The `transformDocument` route is cleaner
  and avoids the extra dependency.

Going with `transformDocument` that walks the document and removes any node
where `node.type === 'table'`, logging the count.

## Image Feasibility

**Feasible — straightforward.** Mammoth exposes each embedded image through
its `convertImage` callback, which receives an `image` object with:

- `image.contentType` (e.g. `"image/png"`, `"image/jpeg"`)
- `image.altText`
- `image.read()` → `Promise<Buffer>`

Flow per image:

1. Await `image.read()` for the raw buffer.
2. Derive an `originalName` from the content type + a short UUID
   (`image-<id>.png`), since OOXML doesn't always store a filename.
3. Call `projectService.addAttachment(fileId, buffer, originalName)`.
4. Return `{ src: "./_attachments/" + attachment.filename, alt: altText }` to
   mammoth.
5. Mammoth emits `![alt](./_attachments/att-xxx.png)` in the markdown.

**Ordering note:** attachments attach to a specific `fileId`, so the new note
must be created *before* conversion runs. We'll:
1. Create the note (empty body via `createFile`).
2. Run mammoth conversion with `convertImage` capturing the new `fileId`.
3. Overwrite the note body via `writeFile` with the converted markdown.

All three steps auto-commit — that's fine (the user sees one logical import,
but git sees three commits). If we want a single commit, we can add a
"suspend commits" flag to `projectService` later; not worth the refactor for
v1.

**Constraints**
- **30MB per attachment.** If an embedded image exceeds this, skip it and
  emit `> [Image omitted: exceeded 30MB limit]`. The full doc still imports.
- **Format support.** Whatever the underlying image is (`png`, `jpg`, `gif`,
  `webp`, `emf`, `wmf`). `emf`/`wmf` are Windows-specific vector formats that
  browsers and markdown preview can't render — treat them as "unsupported"
  and skip with a log entry.
- **Memory.** For very large docs with many images, mammoth loads the whole
  docx into memory (it has to — it's a ZIP). At realistic note sizes this is
  fine; no streaming needed.

## UI Design

### Toolbar button

Add between "New File" (`Ctrl+N`) and "Attachments" (`Ctrl+B`):

```
fa-file-import, title="Import Document (Ctrl+Shift+I)"
```

Disabled when no project is open. Clicking opens a native file picker with a
filter for `.docx` files.

### Import flow

1. User clicks button → file picker opens.
2. User selects a `.docx` → a **busy indicator** appears (small modal
   matching `.modal-compact` style): "Importing <filename>..."
3. Main process runs conversion (typically <1s for normal docs).
4. On success: the modal closes, the newly created note is **selected**, and
   the editor scrolls to the top.
5. A **log entry** summarizes what happened:
   - Filename imported
   - Number of images attached
   - Count of tables stripped (if any)
   - Any mammoth warnings
6. On failure: compact error modal with the error text ("Import failed: …").

### Naming

The new note's `name` defaults to the source filename without the `.docx`
extension. User can rename after the fact via the standard `F2`/context
menu flow.

### No confirmation modal

Unlike New File (which asks for a name and tags), Import goes straight from
file picker → created note. The user just picked the file — a second dialog
would be friction. Renaming/tagging post-import is standard.

## IPC & Data Flow

### New IPC handler

| Channel | Direction | Payload | Returns |
|---|---|---|---|
| `file:import` | renderer → main | `{ sourcePath: string }` | `{ entry, stats: { images, tablesStripped, warnings } }` or `{ error }` |

### `preload.js`

```js
importDocument: (sourcePath) => ipcRenderer.invoke('file:import', sourcePath),
```

### `main.js` handler sketch

```js
ipcMain.handle('file:import', async (_e, { sourcePath }) => {
  if (!projectService.projectPath) return { error: 'No project open' };
  try {
    return await importService.importDocx(sourcePath);
  } catch (err) {
    return { error: err.message };
  }
});
```

### New service — `src/main/import-service.js`

Owns docx-specific logic so `project-service.js` stays format-agnostic.

```js
class ImportService {
  constructor(projectService) { this.projectService = projectService; }

  async importDocx(sourcePath) {
    const buffer = fs.readFileSync(sourcePath);
    const sourceName = path.basename(sourcePath, '.docx');

    // 1. Create empty note up front so we have a fileId for attachments.
    const entry = await this.projectService.createFile(sourceName, []);
    const stats = { images: 0, tablesStripped: 0, warnings: [] };

    // 2. Convert with image + table hooks.
    const result = await mammoth.convertToMarkdown({
      buffer,
      transformDocument: doc => stripTables(doc, stats),
      convertImage: mammoth.images.imgElement(async (image) => {
        stats.images += 1;
        const buf = await image.read();
        if (buf.length > MAX_ATTACHMENT_SIZE) {
          stats.warnings.push(`Image exceeded 30MB, skipped`);
          return { src: '' }; // emits empty ![]() — post-pass removes it
        }
        const ext = extFromContentType(image.contentType);
        const att = await this.projectService.addAttachment(
          entry.id, buf, `image-${shortId()}${ext}`
        );
        return { src: `./_attachments/${att.filename}`, alt: image.altText || '' };
      }),
    }, { styleMap });

    stats.warnings.push(...result.messages.map(m => m.message));

    // 3. Post-process & write.
    const md = postProcess(result.value, sourceName);
    await this.projectService.writeFile(entry.filename, md);

    return { entry, stats };
  }
}
```

### Renderer side (App.svelte)

- Add `handleImportDocument()`:
  1. `const p = await window.api.openFileDialog({ filters: [{ name: 'Word', extensions: ['docx'] }] })` (new dialog variant).
  2. Show busy modal.
  3. `await window.api.importDocument(p)`.
  4. Hide modal; append log entries; select the new file.
- Wire the toolbar button and `Ctrl+Shift+I` keyboard shortcut.
- Add the new shortcut to the Settings modal shortcuts list (see auto-memory:
  keep `SettingsModal` shortcuts array in sync).

### Dialog filter

`dialog:openFiles` currently returns any file. We add a variant or extend it
to accept filters. Cleanest: add a new IPC channel `dialog:openImportFile`
that hardcodes the `.docx` filter, avoiding a breaking change to the generic
file dialog.

## Edge Cases

- **Empty docx** — conversion returns empty string. Create the note with
  just the default heading (don't overwrite with empty body).
- **Corrupted/not-a-docx file** — mammoth throws; we surface the error.
- **Source file >100MB** — reject up front with a friendly error; mammoth
  would try to load it all into memory.
- **Duplicate filename** — `createFile` calls `slugify(name)`; two imports of
  files that slug to the same thing would collide on disk. Need to
  deduplicate slugs (append `-2`, `-3`) the same way attachments do. This is
  a pre-existing gap in `createFile`; fix it as part of this work.
- **Links with no href** (broken hyperlink relationships) — emit plain text.
- **Images with unsupported content type** (`image/x-emf`, `image/x-wmf`) —
  skip with warning; don't create an attachment.
- **Images with zero bytes** — skip with warning.
- **Import during unsaved edits in the editor** — the editor is tied to
  `projectState.selectedFileId`; switching the selection to the new note
  after import is fine, and the editor's own debounced save flushes first.

## Security

- **Path validation:** reject `sourcePath` that isn't an absolute path or
  doesn't exist. Do not follow symlinks outside the user's home directory —
  mammoth reads the file directly, so we don't need sandboxing, but we
  shouldn't accept arbitrary paths without a sanity check.
- **Attachment filename:** derived from content type + short UUID, never from
  the docx's internal `word/media/` filename. This avoids any path-traversal
  concern from a maliciously crafted docx.
- **Hyperlink URLs:** passed through verbatim. Markdown rendering is already
  safe (no script execution in marked output; Preview uses `attachment:`
  protocol handler for local paths).

## Dependencies

Add to `package.json`:
```
"dependencies": {
  "mammoth": "^1.9.0"
}
```

No native modules, no rebuild needed.

## Phasing

**v1 (this plan):**
- mammoth-based `.docx` → Markdown import
- Paragraphs, headings, bold, italics, links, lists, images
- Tables stripped with placeholder
- Toolbar button + `Ctrl+Shift+I`
- Busy modal + log summary

**v2:**
- Table support (convert to GFM-style markdown tables).
- Drag-and-drop import (drop a `.docx` onto the FILES pane).
- Import `.odt` (OpenDocument) — similar internals, likely same approach.

**v3:**
- `.html` / `.md` import (trivial).
- PDF import via `pdfjs-dist` — text extraction only, no layout fidelity.

**v4:**
- "Import folder" — walk a directory of docs, import each as a note,
  preserve folder hierarchy in `noteliner.json` parentIds.
