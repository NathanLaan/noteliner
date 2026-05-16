# NoteLiner

NoteLiner is a single-user outliner-style note-taking application, built with Electron and Svelte 5. It allows users to create and organize files in a hierarchical structure. Each file is written in Markdown with syntax highlighting, and all changes are automatically synced via Git.

NoteLiner should be considered BETA software. I wrote it for my own personal use, and it meets my specific needs.

## Features

- Hierarchical file organization with drag-and-drop reordering
- Markdown editor with syntax highlighting (CodeMirror 6)
- Live markdown preview panel
- File attachments (paste, drag-and-drop, or file picker) with image thumbnails
- Automatic Git commit on every change with debounced push to remote
- Optional MCP server — expose the open project to AI assistants (Claude Code, Claude Desktop, Cursor) via local-only stdio bridge
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

## MCP Server

NoteLiner can expose the currently-open project to external AI assistants
(Claude Code, Claude Desktop, Cursor, ...) via the
[Model Context Protocol](https://modelcontextprotocol.io). When enabled,
the AI can list, read, search, and write notes — every write goes through
the same save path as the UI and is committed to git automatically.

The server is local-only: no TCP port is opened. NoteLiner listens on a
Unix domain socket (or Windows named pipe) that only the local user can
read, and external clients connect through a small `noteliner-mcp-bridge`
helper that pipes stdio to that socket.

### Enabling

Settings → MCP → toggle "Enable MCP server". Every off→on transition
opens a one-screen walkthrough that explains the architecture and offers
a copy-paste config snippet for your client. The server only runs while
a project is open; closing the project (or disabling MCP) tears it down.

### Client configuration

Drop this into your MCP client's config file — for Claude Code, that's
`.mcp.json` in the project root; for Claude Desktop,
`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "noteliner": {
      "command": "node",
      "args": ["/absolute/path/to/noteliner-mcp-bridge.js"]
    }
  }
}
```

The exact bridge path for your install appears in Settings → MCP →
Client Configuration with a one-click copy button. Don't hand-edit the
path — it differs between dev runs and packaged installs.

### Tools

| Tool | Purpose | Kind |
|---|---|---|
| `list_notes` | List every note (id, name, filename, tags, parentId) | read |
| `read_note` | Read a note's body by id or name | read |
| `search` | Full-text search across note bodies | read |
| `get_backlinks` | List notes linking to a target via wikilinks | read |
| `list_attachments` | List attachments on a note | read |
| `list_tags` | Tag histogram with note counts and ids | read |
| `create_note` | Create a new note | write |
| `update_note` | Replace a note's body | write |
| `delete_note` | Delete a note (children reparent) | write |
| `rename_note` | Rename a note (filename re-slugged) | write |
| `set_tags` | Replace a note's tag list | write |
| `add_attachment` | Attach a binary file (base64, 30MB cap) | write |
| `remove_attachment` | Remove an attachment by id | write |

### Resources and prompts

Three resource URIs are also exposed for clients that prefer
resource-style reads: `noteliner://index` (the full `noteliner.json`),
`noteliner://note/{id}` (a note's body), and
`noteliner://attachment/{filename}` (binary attachment data, base64).

Four MCP prompts surface in clients that render prompts as slash
commands: `daily_note` (with optional date/topic), `meeting_note`
(required topic + optional attendees), `summarize_note` (server-side
fetches the body and embeds it), and `link_suggestions` (server-side
includes the body plus the names of all other notes so the model can
suggest wikilink targets).

### Safety

- **Confirm before writes** (Settings → MCP → Safety) — when enabled,
  NoteLiner asks for permission before running every write tool. The
  modal offers *Allow once*, *Allow for the session*, or *Deny*.
  Session trust is cleared when the project closes or NoteLiner quits.
- **Per-tool allow/deny** (Settings → MCP → Tool Access) — individual
  tools can be disabled. Disabled tools return a structured error to
  the client. Works for both read and write tools.
- **Single-project scope** — the server only ever exposes the
  currently open project. Switching projects bounces the server before
  the new project's data becomes reachable.
- **Local-only socket** — Unix socket files are `chmod 0600`; Windows
  named pipes are user-scoped by default. No TCP port is bound, no
  remote transport is supported.
- **Body size caps** — write tools reject bodies above 10MB;
  attachments inherit the 30MB cap from `ProjectService`.

Every MCP tool call is logged to the Log panel (`Ctrl+L`), prefixed
`[MCP]`, so you can see exactly what the AI just did.

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

Two suites cover different layers. Both run from the repo root.

### End-to-end (Playwright) — UI through Electron

Five focused tests that boot the real Electron app and assert against
on-disk state: app launches, create-and-persist, rename, delete, and
attachments. Run these whenever you touch the renderer, the IPC layer,
or `ProjectService`.

```bash
npm run build           # tests load dist/, so build first
npm test                # headless
npm run test:headed     # show the Electron window
npm run test:debug      # step through with the Playwright Inspector
```

The first run installs Playwright's bundled browsers automatically.

See [`tests/README.md`](tests/README.md) for the test mandate and how
the Electron harness works.

### MCP bridge integration — protocol through the real bridge

Spawns `bin/noteliner-mcp-bridge.js` as a child process and drives it
with a synthetic JSON-RPC client — the same wire path Claude Code,
Claude Desktop, and Cursor use. Twenty-four assertions across the six
items from the MCP plan's Testing section: list/create round-trip,
search parity with the in-app search, mid-call disconnect, project
switch isolation, and stale-socket recovery.

```bash
npm run test:mcp        # ~3 seconds; requires git on PATH
```

Runs in plain Node — no Electron, no browser. Suitable for CI as well
as a fast pre-commit check whenever you touch `src/main/mcp-service.js`
or the bridge binary.

See [`tests/integration/README.md`](tests/integration/README.md) for
coverage details and the short manual checklist for UI-side
verification with a real MCP client (the bits that genuinely need a
human eyeballing the FILES pane).

## Technology

- [Electron](https://www.electronjs.org/) -- Desktop application framework
- [Svelte 5](https://svelte.dev/) -- Reactive UI framework
- [Vite](https://vitejs.dev/) -- Build tool
- [CodeMirror 6](https://codemirror.net/) -- Text editor
- [marked](https://marked.js.org/) -- Markdown parser
- [Font Awesome](https://fontawesome.com/) -- Icons
