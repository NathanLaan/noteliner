// Help pages shown in the HelpModal. Each page renders as markdown via the
// shared Preview component. Pages are grouped by `section` in the index.
//
// To add a new page: append an entry below. The HelpModal's search will pick
// it up automatically — both `title` and `body` participate in full-text match.

export const helpPages = [
  {
    id: 'overview',
    title: 'Welcome to NoteLiner',
    section: 'Overview',
    body: `# Welcome to NoteLiner

NoteLiner is an outliner-style markdown note-taking application built with
Electron and Svelte. Your notes live as plain ` + '`.md`' + ` files inside a folder
on disk, and the app tracks edits via Git so you can review, sync, and roll
back changes at any time.

## What's in this Help

- **Toolbar buttons** — every icon on the left toolbar has a dedicated page
  describing what it does and which keyboard shortcut triggers it.
- **Panels** — the Files, Outline, Tags, Tag Groups, Search, Backlinks,
  Attachments, History, and Log panels each have their own page.
- **Workflow guides** — how to create files, import documents, link notes
  with ` + '`[[wikilinks]]`' + `, sync to a remote Git repository, and export to
  HTML/PDF/Markdown.

## Tips for using this dialog

- Type into the **search box** on the left to find pages whose content
  contains your term. Matches stay highlighted; non-matching pages are
  grayed out.
- **Drag** the divider between the index and content panes to resize them.
- Press **Escape** to close.
`,
  },

  {
    id: 'getting-started',
    title: 'Getting Started',
    section: 'Overview',
    body: `# Getting Started

1. **Open a folder** with the *Open Folder* toolbar button (or ` + '`Ctrl+O`' + `).
   NoteLiner will initialize Git in that folder if it isn't already a
   repository.
2. **Create your first note** with *New File* (` + '`Ctrl+N`' + `) and give it a
   short, descriptive name. The file is created as ` + '`<id>-<slug>.md`' + ` and
   selected immediately.
3. **Write in markdown**. The editor is plain text — links, headings, lists,
   code blocks, and ` + '`[[wikilinks]]`' + ` all render in the Preview pane
   (` + '`Ctrl+P`' + `).
4. **Tag, link, and organize**. Apply tags from the Tags pane, group tags
   into collections with Tag Groups, and connect notes with ` + '`[[wikilinks]]`' + `.
5. **Sync** to a Git remote (` + '`Ctrl+Shift+S`' + `) when you want to back up or
   share your project.
`,
  },

  // ── Toolbar buttons ──────────────────────────────────────────────────────

  {
    id: 'toolbar-home',
    title: 'Home',
    section: 'Toolbar',
    body: `# Home

Closes the currently open project and returns you to the open-screen, where
you can open another folder, create a new project, or pick from your recent
projects list.

Before closing, NoteLiner saves your window layout (panel widths, visible
panes, etc.) and flushes any pending commits to Git. A *Syncing…* dialog
appears briefly while this happens.
`,
  },

  {
    id: 'toolbar-open-folder',
    title: 'Open Folder',
    section: 'Toolbar',
    body: `# Open Folder

**Shortcut:** ` + '`Ctrl+O`' + `

Opens a system folder picker. Choose any folder on disk:

- If the folder already contains a NoteLiner project (a ` + '`.noteliner/`' + ` index
  and a Git repository), it opens directly.
- If the folder exists but is not yet a project, the **Setup** dialog
  appears so you can optionally connect a remote Git URL before
  initializing.

NoteLiner remembers recently opened folders on the open-screen.
`,
  },

  {
    id: 'toolbar-new-file',
    title: 'New File',
    section: 'Toolbar',
    body: `# New File

**Shortcut:** ` + '`Ctrl+N`' + `

Creates a new markdown note inside the current project. You'll be prompted
for a display name and an optional set of tags. The file is saved as
` + '`<id>-<slug>.md`' + ` and selected for editing right away.

New files can also be created on the fly by clicking a *dangling*
` + '`[[wikilink]]`' + ` in the Preview pane — see the **Wikilinks** page.
`,
  },

  {
    id: 'toolbar-import',
    title: 'Import Document',
    section: 'Toolbar',
    body: `# Import Document

**Shortcut:** ` + '`Ctrl+Shift+I`' + `

Imports an external document into the current project, converting it to
markdown. Embedded images are extracted into the project's ` + '`_attachments/`' + `
folder and rewritten as markdown image references.

A summary line appears in the Log pane noting how many images were
extracted and whether any tables were stripped during conversion.
`,
  },

  {
    id: 'toolbar-files',
    title: 'Files Panel',
    section: 'Toolbar',
    body: `# Files Panel

**Shortcut:** ` + '`Ctrl+E`' + `

Toggles the **Files** sidebar pane. The Files pane lists every note in the
project. Click a file to open it in the editor.

Right-click a file for a context menu with quick actions: open in your
system file manager, delete the file, clear all tags, toggle preview, or
export the note to HTML, PDF, or Markdown.

Use ` + '`Ctrl+PgUp`' + ` / ` + '`Ctrl+PgDn`' + ` to step through files without leaving
the keyboard.
`,
  },

  {
    id: 'toolbar-outline',
    title: 'Outline Panel',
    section: 'Toolbar',
    body: `# Outline Panel

**Shortcut:** ` + '`Ctrl+Shift+O`' + `

Toggles the **Outline** sidebar pane. The Outline shows every heading in
the current note as a tree. Click any heading to jump straight to that
section of the editor.

The outline updates live as you type, so it doubles as a structural
overview while you write.
`,
  },

  {
    id: 'toolbar-tags',
    title: 'Tags Panel',
    section: 'Toolbar',
    body: `# Tags Panel

**Shortcut:** ` + '`Ctrl+Shift+T`' + `

Toggles the **Tags** sidebar pane. Lists every tag applied to the
currently selected file.

- **Add a tag:** ` + '`Ctrl+T`' + ` (or ` + '`Ctrl+Shift++`' + ` when the Tags pane is
  visible).
- **Remove a tag:** ` + '`Ctrl+Y`' + `.

Tags are stored in each file's YAML frontmatter when frontmatter writing
is enabled in Settings — otherwise they live only in the project index.
`,
  },

  {
    id: 'toolbar-tag-groups',
    title: 'Tag Groups Panel',
    section: 'Toolbar',
    body: `# Tag Groups Panel

**Shortcut:** ` + '`Ctrl+G`' + `

Toggles the **Tag Groups** sidebar pane. Tag groups let you bundle related
tags together for easier filtering and discovery. Click a group to filter
the Files pane to notes carrying any tag in that group.
`,
  },

  {
    id: 'toolbar-attachments',
    title: 'Attachments Panel',
    section: 'Toolbar',
    body: `# Attachments Panel

**Shortcut:** ` + '`Ctrl+B`' + `

Toggles the **Attachments** side panel (right side). Shows every file in
the project's ` + '`_attachments/`' + ` folder — images, PDFs, and other binary
assets pulled in by imports or dropped manually.

From here you can preview attachments, copy their paths, or insert a
markdown reference into the active note.
`,
  },

  {
    id: 'toolbar-search',
    title: 'Search Panel',
    section: 'Toolbar',
    body: `# Search Panel

**Shortcut:** ` + '`Ctrl+F`' + `

Toggles the **Search** sidebar pane and focuses the search input.
Performs a project-wide, full-text search across every note. Results group
by file; click any matched line to jump to that location in the editor.

To search *inside* the current file only, use the editor's built-in
find with ` + '`Ctrl+Shift+F`' + `.
`,
  },

  {
    id: 'toolbar-backlinks',
    title: 'Backlinks Panel',
    section: 'Toolbar',
    body: `# Backlinks Panel

**Shortcut:** ` + '`Ctrl+Shift+B`' + `

Toggles the **Backlinks** sidebar pane. Lists every other note in the
project that contains a ` + '`[[wikilink]]`' + ` pointing to the currently
selected file.

Each entry shows the source note's name and the specific line containing
the link. Click an entry to jump straight to that line in the source
note.
`,
  },

  {
    id: 'toolbar-sync',
    title: 'Remote Sync',
    section: 'Toolbar',
    body: `# Remote Sync

**Shortcut:** ` + '`Ctrl+Shift+S`' + `

Opens the **Remote Sync** dialog for managing your project's Git remote:

- **Connect** a remote URL (GitHub, GitLab, Gitea, self-hosted, etc.).
- **Pull**, **Pull & Rebase**, or **Push** to/from the remote.
- View **sync status** — synced, ahead, behind, or diverged.
- **Reset from Remote** to discard all local changes and match the remote
  exactly. *(Destructive — cannot be undone.)*
- **Disconnect** the remote without touching your files.

If no remote is configured, the dialog walks you through connecting one.
`,
  },

  {
    id: 'toolbar-log',
    title: 'Log Panel',
    section: 'Toolbar',
    body: `# Log Panel

**Shortcut:** ` + '`Ctrl+L`' + `

Toggles the **Log** panel at the bottom of the window. Surfaces
informational messages from NoteLiner: import results, sync activity,
warnings, and errors.

Drag the top edge to resize.
`,
  },

  {
    id: 'toolbar-project-settings',
    title: 'Project Settings',
    section: 'Toolbar',
    body: `# Project Settings

**Shortcut:** ` + '`Ctrl+Shift+,`' + `

Opens the **Project Settings** dialog for the currently open project.
Covers Git author identity (name and email used for commits) and other
per-project preferences.

If a required setting is missing when you open a project, NoteLiner
opens this dialog automatically.
`,
  },

  {
    id: 'toolbar-settings',
    title: 'Settings',
    section: 'Toolbar',
    body: `# Settings

**Shortcut:** ` + '`Ctrl+,`' + `

Opens the **Settings** dialog with two tabs:

- **UI** — theme, UI scale, custom window titlebar, and whether to write
  YAML frontmatter into ` + '`.md`' + ` files on save.
- **Keyboard Shortcuts** — a complete, auto-generated list of every
  command and its shortcut. Pulled directly from the command registry,
  so it always matches what the app actually responds to.
`,
  },

  {
    id: 'toolbar-about',
    title: 'About',
    section: 'Toolbar',
    body: `# About

**Shortcut:** ` + '`Ctrl+I`' + `

Shows the **About** dialog with the application name, version, and a
link to the GitHub repository.
`,
  },

  {
    id: 'toolbar-help',
    title: 'Help',
    section: 'Toolbar',
    body: `# Help

Opens this Help dialog. Type in the search box on the left to filter the
index by content; non-matching pages are grayed out. Drag the vertical
divider to resize the index and content panes. Press **Escape** to close.
`,
  },

  // ── Editing & viewing ────────────────────────────────────────────────────

  {
    id: 'editor',
    title: 'Editor',
    section: 'Editing',
    body: `# Editor

The central pane is a plain-text markdown editor (CodeMirror under the
hood). Everything you type is auto-saved and, on a short debounce,
committed to Git in the background.

## Useful editor shortcuts

- ` + '`Ctrl+Shift+F`' + ` — find in current file
- ` + '`Ctrl+P`' + ` — toggle the Preview pane
- ` + '`Ctrl+H`' + ` — toggle the History pane

Headings, lists, code blocks, blockquotes, tables, images, and
` + '`[[wikilinks]]`' + ` all render in Preview exactly as you'd expect from
standard markdown.
`,
  },

  {
    id: 'preview',
    title: 'Preview Pane',
    section: 'Editing',
    body: `# Preview Pane

**Shortcut:** ` + '`Ctrl+P`' + `

The Preview pane renders the current note's markdown as styled HTML.
` + '`[[wikilinks]]`' + ` become clickable: solid links open the target note;
dashed (*dangling*) links offer to create the target note when clicked.

Right-click anywhere inside the preview for a context menu with
**Select All**, **Copy**, and the **Save to HTML / PDF / Markdown**
export actions.

Drag the left edge of the pane to resize it.
`,
  },

  {
    id: 'history',
    title: 'History Pane',
    section: 'Editing',
    body: `# History Pane

**Shortcut:** ` + '`Ctrl+H`' + `

Shows the Git commit history for the currently selected note. Each entry
lists the commit message, author, and timestamp; click an entry to view
the file's contents at that point in time.

Because every save commits in the background, history gives you a
fine-grained timeline of how each note evolved.
`,
  },

  {
    id: 'wikilinks',
    title: 'Wikilinks',
    section: 'Editing',
    body: `# Wikilinks

Type ` + '`[[Note Name]]`' + ` anywhere in a note to link to another note by
name. In Preview:

- Links that resolve to an existing note are solid and clickable —
  clicking jumps to that note.
- Links that don't resolve appear with a **dashed underline**. Clicking
  one opens the **New File** dialog pre-filled with that name.

Pipe syntax (` + '`[[Real Name|Display Text]]`' + `) lets you show a different
label while still pointing at the target.

The **Backlinks** panel lists every note pointing *at* the current
note, so you can navigate your link graph in either direction.
`,
  },

  {
    id: 'export',
    title: 'Export to HTML / PDF / Markdown',
    section: 'Editing',
    body: `# Export

NoteLiner can save the current note as a standalone document outside of
the project folder:

- **Save to HTML** — fully styled HTML.
- **Save to PDF** — uses the system's print-to-PDF pipeline.
- **Save to Markdown** — a clean ` + '`.md`' + ` copy without frontmatter or
  project metadata.

Trigger any of these from:

- the Preview pane's right-click context menu, or
- the Files pane's right-click context menu on the selected file.

After saving, NoteLiner opens your Downloads folder so you can pick up
the exported file.
`,
  },

  // ── App-level ────────────────────────────────────────────────────────────

  {
    id: 'command-palette',
    title: 'Command Palette',
    section: 'App',
    body: `# Command Palette

**Shortcut:** ` + '`Ctrl+K`' + ` (also ` + '`Ctrl+Shift+P`' + `)

Opens the Command Palette — a fuzzy-searchable list of every action in
the app. Type a few letters of any command name to find it; ` + '`Enter`' + `
runs it.

Recently used commands appear at the top of the list, so frequent
actions stay one keystroke away.
`,
  },

  {
    id: 'titlebar-toolbar-toggle',
    title: 'Toolbar Toggle',
    section: 'App',
    body: `# Toolbar Toggle

**Shortcut:** ` + '`Ctrl+Shift+E`' + `

Hides or shows the left-side toolbar. Useful when you want maximum
horizontal space for the editor and preview.

When the custom titlebar is enabled (Settings → UI → Custom Window
Titlebar), the toolbar can also be toggled from the hamburger icon in
the titlebar itself.
`,
  },

  {
    id: 'zoom',
    title: 'Zoom',
    section: 'App',
    body: `# Zoom

Adjust the entire UI's zoom level:

- ` + '`Ctrl+=`' + ` — zoom in
- ` + '`Ctrl+-`' + ` — zoom out
- ` + '`Ctrl+0`' + ` — reset to 100%

For a coarser change, pick a UI Scale in **Settings → UI**.
`,
  },

  {
    id: 'themes',
    title: 'Themes',
    section: 'App',
    body: `# Themes

NoteLiner ships with three themes:

- **Midnight** — deep, low-contrast dark theme.
- **Dark** — neutral dark theme.
- **Light** — bright theme for daytime use.

Switch from **Settings → UI → Theme**, or from the Command Palette
(*Set Theme: Midnight / Dark / Light*).
`,
  },

  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    section: 'App',
    body: `# Keyboard Shortcuts

A complete, always-up-to-date shortcut reference lives in
**Settings → Keyboard Shortcuts**. The list is generated from the
command registry, so anything the app responds to is documented there.

Highlights:

- ` + '`Ctrl+K`' + ` — Command Palette
- ` + '`Ctrl+N`' + ` / ` + '`Ctrl+D`' + ` — new / delete file
- ` + '`Ctrl+O`' + ` — open folder
- ` + '`Ctrl+P`' + ` / ` + '`Ctrl+H`' + ` — preview / history
- ` + '`Ctrl+E`' + ` / ` + '`Ctrl+Shift+E`' + ` — toggle sidebar / toolbar
- ` + '`Ctrl+F`' + ` / ` + '`Ctrl+Shift+F`' + ` — project search / find in file
- ` + '`Ctrl+Shift+S`' + ` — remote sync
- ` + '`Ctrl+,`' + ` / ` + '`Ctrl+Shift+,`' + ` — settings / project settings
- ` + '`Ctrl+I`' + ` — about
`,
  },
];
