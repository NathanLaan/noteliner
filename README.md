# NoteLiner

NoteLiner is a single-user outliner-style note-taking application, built with Electron and Svelte 5. It allows users to create and organize files in a hierarchical structure. Each file is written in Markdown with syntax highlighting, and all changes are automatically synced via Git.

NoteLiner should be considered BETA software. I wrote it for my own personal use, and it meets my specific needs.

## Features

- Hierarchical file organization with drag-and-drop reordering
- Markdown editor with syntax highlighting (CodeMirror 6)
- Live markdown preview panel
- File attachments (paste, drag-and-drop, or file picker) with image thumbnails
- Automatic Git commit on every change with debounced push to remote
- Three built-in themes: Midnight, Dark, and Light
- Keyboard shortcuts for all major actions

## Data Storage

NoteLiner works with the concept of a **Project**, which is a folder on the user's computer containing:

1. A local Git repository, optionally linked to a remote on GitHub or GitLab.
2. An index file (`noteliner.json`) tracking all files, their hierarchy, tags, and attachments.
3. Markdown files (`.md`) in the project root.
4. An `_attachments/` directory for files attached to notes (images, PDFs, etc.).

Changes are committed locally whenever a file is added, removed, or modified. Commits are pushed to the remote repository on a 30-second debounce timer, enabling cross-device sync via Git.

## User Interface

### Toolbar (left edge)

A vertical toolbar with icon buttons:

| Button | Shortcut | Description |
|---|---|---|
| Open Folder | `Ctrl+O` | Open a project folder. Loads existing projects or prompts to create/clone. |
| New File | `Ctrl+N` | Create a new file in the project. |
| Attachments | `Ctrl+B` | Toggle the attachments sidebar. |
| Show Log | `Ctrl+L` | Toggle the git sync log panel. |
| Project Settings | `Ctrl+Shift+,` | Configure git user name/email, view project location. |
| Settings | `Ctrl+,` | Change application theme. |
| About | `Ctrl+I` | Show application name and version. |

### Panels

- **Left sidebar** -- Resizable file tree showing the project hierarchy. Files can be dragged to reorder or re-parent. Double-click to rename, right-click for context menu.
- **Editor** -- CodeMirror 6 markdown editor with syntax highlighting, line wrapping, and auto-save (500ms debounce). Supports paste and drag-and-drop for file attachments.
- **Preview** (`Ctrl+P`) -- Live rendered markdown preview with image support.
- **Attachments sidebar** (`Ctrl+B`) -- Right panel showing files attached to the current note. Images display as thumbnails; other files show a type icon. Add via paste, drag-and-drop, or the `[+]` button (native file picker). Double-click to open with the system default application.
- **Log panel** (`Ctrl+L`) -- Bottom panel showing git sync activity in real time.

### Modal Dialogs

All modal dialogs support `Enter` to confirm and `Escape` to close.

- **Set Up Project** -- Shown when opening a folder that isn't a NoteLiner project. Choose to create a new repository or clone from a remote URL.
- **Project Settings** -- Git user name/email configuration and project folder location. Automatically shown if git config is missing (required for saving).
- **Settings** -- Theme selection (Midnight, Dark, Light).
- **About** -- Application name and version (SemVer + git commit hash).

## Attachments

Files can be attached to any note via:

- **Paste** -- Paste from clipboard onto the editor.
- **Drag-and-drop** -- Drop files onto the editor area.
- **File picker** -- Click `[+]` in the attachments panel.

Attachments are stored in the `_attachments/` directory and tracked in `noteliner.json`. A markdown reference is automatically inserted at the cursor: `![name](path)` for images, `[name](path)` for other files. Maximum file size is 30MB.

## Versioning

Released builds display the bare semver from `package.json` (e.g. `0.5.0`).
Local development builds append the short git commit hash and a `dev` marker
(e.g. `0.5.0-dev.8c6e3d6`) so it's always obvious whether you're running an
unreleased build. The version is injected at build time via Vite's `define`.

## Installation

Pre-built binaries for Linux, Windows, and macOS are published from the
[Releases page](https://github.com/NathanLaan/noteliner/releases) on each
tag.

- **Linux** — download the `.AppImage`, `chmod +x`, run. Or
  `sudo dpkg -i noteliner_*_amd64.deb`.
- **Windows** — download the `.exe` installer, run. The first launch may
  show a SmartScreen warning (current builds are unsigned); click
  "More info" → "Run anyway."
- **macOS** — download the `.dmg`, drag NoteLiner to `/Applications`. The
  first launch will be blocked by Gatekeeper (current builds are unsigned);
  right-click NoteLiner in `/Applications` → "Open" → "Open" to bypass.

Once a release is installed, NoteLiner checks for updates on each launch
and downloads them in the background. The Log panel shows progress.

## Development

```bash
npm install
npm run electron:dev    # Start in development mode
npm run build           # Build the renderer (Vite)
npm run start           # Run the built Electron app
```

## Building Distributable Binaries

```bash
npm run build:linux     # AppImage + .deb (Linux only)
npm run build:win       # NSIS installer + portable .exe
npm run build:mac       # .dmg + .zip (universal)
npm run build:all       # all three (cross-compile; works best on macOS)
```

Output lands in `dist-electron/`. Cross-compilation has limits — the
authoritative builds happen in CI via `.github/workflows/release.yml` on
tag push, with one runner per OS.

The 512×512 build icon (`build/icon.png`) is checked in; regenerate it
from `assets/icon.png` with `npm run build:icons` if the source icon
changes (requires ImageMagick).

## Testing

End-to-end smoke tests run against the real Electron app via Playwright.

```bash
npm run build           # tests run against dist/, build first
npm test                # headless
npm run test:headed     # show the Electron window
npm run test:debug      # Playwright Inspector
```

See `tests/README.md` for the test mandate and how the harness works.

## Technology

- [Electron](https://www.electronjs.org/) -- Desktop application framework
- [Svelte 5](https://svelte.dev/) -- Reactive UI framework
- [Vite](https://vitejs.dev/) -- Build tool
- [CodeMirror 6](https://codemirror.net/) -- Text editor
- [marked](https://marked.js.org/) -- Markdown parser
- [Font Awesome](https://fontawesome.com/) -- Icons
